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

/** Units of a group (summed over the kit's quantity) that the stock can't fill. */
export interface GroupShortage {
	kitId: string;
	/** Index of the group in the kit. */
	groupIndex: number;
	missingUnits: number;
}

export interface Allocation {
	needs: MaterialNeed[];
	shortages: GroupShortage[];
}

/**
 * Distributes the available stock over the groups of the selected kits.
 *
 * Groups with a single option are served first, since they can't fall back to anything else. Every group then takes
 * its options in priority order (lowest first): first only whole pieces that fit into the remaining units, then
 * rounding up to cover the rest, so a large piece isn't used where smaller ones fit exactly. If the stock runs out,
 * the missing pieces are counted on the group's preferred option, so the shortage shows up there, and the missing
 * units are reported per group so they can be filled with any of its options. This is a greedy
 * approach: it doesn't search for the best possible combination, which is fine for the small number of
 * interchangeable materials in practice.
 *
 * @param stock usable pieces per material id
 */
export function allocate(
	selections: KitSelection[],
	stock: ReadonlyMap<string, number>
): Allocation {
	const demands = selections.flatMap(({ kit, quantity, includedGroups }) =>
		kit.groups.flatMap((group, groupIndex) =>
			!group.isOptional || includedGroups.has(groupIndex)
				? [
						{
							kitId: kit.id,
							groupIndex,
							units: group.requiredUnits * quantity,
							options: group.options.toSorted((a, b) => a.priority - b.priority)
						}
					]
				: []
		)
	);
	demands.sort((a, b) => Number(a.options.length > 1) - Number(b.options.length > 1));

	const left = new Map(stock);
	const needs = new Map<string, Map<string, number>>(); // material id → kit id → pieces
	function take(materialId: string, kitId: string, pieces: number) {
		const byKit = needs.get(materialId) ?? new Map<string, number>();
		byKit.set(kitId, (byKit.get(kitId) ?? 0) + pieces);
		needs.set(materialId, byKit);
	}

	const shortages: GroupShortage[] = [];
	for (const { kitId, groupIndex, units, options } of demands) {
		let remaining = units;
		for (const round of [Math.floor, Math.ceil]) {
			for (const option of options) {
				if (remaining <= 0) break;
				const pieces = Math.min(
					round(remaining / option.unitValue),
					left.get(option.materialId) ?? 0
				);
				if (pieces <= 0) continue;
				left.set(option.materialId, (left.get(option.materialId) ?? 0) - pieces);
				take(option.materialId, kitId, pieces);
				remaining -= pieces * option.unitValue;
			}
		}
		if (remaining > 0) {
			const [preferred] = options;
			take(preferred.materialId, kitId, Math.ceil(remaining / preferred.unitValue));
			shortages.push({ kitId, groupIndex, missingUnits: remaining });
		}
	}

	return {
		needs: [...needs].map(([materialId, byKit]) => ({
			materialId,
			required: [...byKit.values()].reduce((sum, pieces) => sum + pieces, 0),
			available: stock.get(materialId) ?? 0,
			byKit: [...byKit].map(([kitId, quantity]) => ({ kitId, quantity }))
		})),
		shortages
	};
}
