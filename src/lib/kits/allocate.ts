import type { Kit } from '#lib/api/index.js';

export interface KitSelection {
	kit: Kit;
	quantity: number;
	/** Indices of the optional groups that are packed. */
	includedGroups: ReadonlySet<number>;
}

export interface MaterialNeed {
	materialId: string;
	/** Pieces to pack, including pieces that are missing. */
	required: number;
	available: number;
	byKit: { kitId: string; quantity: number }[];
}

/**
 * Distributes the available stock over the groups of the selected kits.
 *
 * Groups with a single option are served first, since they can't fall back to anything else. Every group then takes
 * its options in priority order (lowest first). If the stock runs out, the missing pieces are counted on the group's
 * preferred option, so the shortage shows up there. This is a greedy approach: it doesn't search for the best
 * possible combination, which is fine for the small number of interchangeable materials in practice.
 *
 * @param stock usable pieces per material id
 */
export function allocate(
	selections: KitSelection[],
	stock: ReadonlyMap<string, number>
): MaterialNeed[] {
	const demands = selections.flatMap(({ kit, quantity, includedGroups }) =>
		kit.groups
			.filter((group, index) => !group.isOptional || includedGroups.has(index))
			.map((group) => ({
				kitId: kit.id,
				units: group.requiredUnits * quantity,
				options: group.options.toSorted((a, b) => a.priority - b.priority)
			}))
	);
	demands.sort((a, b) => Number(a.options.length > 1) - Number(b.options.length > 1));

	const left = new Map(stock);
	const needs = new Map<string, Map<string, number>>(); // material id → kit id → pieces
	function take(materialId: string, kitId: string, pieces: number) {
		const byKit = needs.get(materialId) ?? new Map<string, number>();
		byKit.set(kitId, (byKit.get(kitId) ?? 0) + pieces);
		needs.set(materialId, byKit);
	}

	for (const { kitId, units, options } of demands) {
		let remaining = units;
		for (const option of options) {
			if (remaining <= 0) break;
			const pieces = Math.min(
				Math.ceil(remaining / option.unitValue),
				left.get(option.materialId) ?? 0
			);
			if (pieces <= 0) continue;
			left.set(option.materialId, (left.get(option.materialId) ?? 0) - pieces);
			take(option.materialId, kitId, pieces);
			remaining -= pieces * option.unitValue;
		}
		if (remaining > 0) {
			const [preferred] = options;
			take(preferred.materialId, kitId, Math.ceil(remaining / preferred.unitValue));
		}
	}

	return [...needs].map(([materialId, byKit]) => ({
		materialId,
		required: byKit.values().reduce((sum, pieces) => sum + pieces, 0),
		available: stock.get(materialId) ?? 0,
		byKit: [...byKit].map(([kitId, quantity]) => ({ kitId, quantity }))
	}));
}
