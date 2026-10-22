import type { Kit } from '#lib/api/index.js';

/** A line of the packing list: a kit, how many of it, and the amount chosen per group. */
export interface KitSelection {
	kit: Kit;
	quantity: number;
	/** Index into the group's `amounts` per group index; missing entries mean the default, 0. */
	choices: readonly number[];
}

/** Pieces of a material packed for a group of a line. */
export interface Assignment {
	/** Index of the line in the selections. */
	line: number;
	groupIndex: number;
	materialId: string;
	pieces: number;
	/** Whether the pieces are missing from the stock (a group's shortage, counted on its preferred option). */
	missing: boolean;
}

/** Units of a group (summed over the line's quantity) that the stock can't fill. */
export interface GroupShortage {
	/** Index of the line in the selections. */
	line: number;
	/** Index of the group in the kit. */
	groupIndex: number;
	missingUnits: number;
}

export interface Allocation {
	assignments: Assignment[];
	shortages: GroupShortage[];
}

export interface MaterialNeed {
	materialId: string;
	/** Pieces to pack, including pieces that are missing. */
	required: number;
	available: number;
	/** Pieces per line, in the order of the lines. */
	byLine: { line: number; pieces: number }[];
}

/** The units a group of [selection] needs for one kit, by the chosen amount. */
export function unitsOf(selection: Omit<KitSelection, 'quantity'>, groupIndex: number): number {
	const { amounts } = selection.kit.groups[groupIndex];
	return (amounts[selection.choices[groupIndex] ?? 0] ?? amounts[0])?.requiredUnits ?? 0;
}

/**
 * Distributes the available stock over the groups of the selected lines.
 *
 * Every group of a line needs the units of its chosen amount times the line's quantity; groups with 0 units are
 * skipped. Groups with a single option are served first, since they can't fall back to anything else. Every group then
 * takes its options in priority order (lowest first): first only whole pieces that fit into the remaining units, then
 * rounding up to cover the rest, so a large piece isn't used where smaller ones fit exactly. If the stock runs out,
 * the missing pieces are assigned to the group's preferred option (marked as missing), so the shortage shows up
 * there, and the missing units are reported per group so they can be filled with any of its options. This is a
 * greedy approach: it doesn't search for the best possible combination, which is fine for the small number of
 * interchangeable materials in practice.
 *
 * @param stock usable pieces per material id
 */
export function allocate(
	selections: KitSelection[],
	stock: ReadonlyMap<string, number>
): Allocation {
	const demands = selections.flatMap((selection, line) =>
		selection.kit.groups.flatMap((group, groupIndex) => {
			const units = unitsOf(selection, groupIndex) * selection.quantity;
			if (units <= 0) return [];
			const options = group.options.toSorted((a, b) => a.priority - b.priority);
			return [{ line, groupIndex, units, options }];
		})
	);
	demands.sort((a, b) => Number(a.options.length > 1) - Number(b.options.length > 1));

	const left = new Map(stock);
	const assignments: Assignment[] = [];
	const shortages: GroupShortage[] = [];
	for (const { line, groupIndex, units, options } of demands) {
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
				assignments.push({
					line,
					groupIndex,
					materialId: option.materialId,
					pieces,
					missing: false
				});
				remaining -= pieces * option.unitValue;
			}
		}
		if (remaining > 0) {
			const [preferred] = options;
			assignments.push({
				line,
				groupIndex,
				materialId: preferred.materialId,
				pieces: Math.ceil(remaining / preferred.unitValue),
				missing: true
			});
			shortages.push({ line, groupIndex, missingUnits: remaining });
		}
	}
	return { assignments, shortages };
}

/**
 * What to pack per material: the [assignments] summed per material, in the order materials first appear, and broken
 * down by line.
 *
 * @param stock usable pieces per material id
 */
export function needsOf(
	assignments: Assignment[],
	stock: ReadonlyMap<string, number>
): MaterialNeed[] {
	const byMaterial = new Map<string, Map<number, number>>(); // material id → line → pieces
	for (const { materialId, line, pieces } of assignments) {
		const byLine = byMaterial.get(materialId) ?? new Map<number, number>();
		byLine.set(line, (byLine.get(line) ?? 0) + pieces);
		byMaterial.set(materialId, byLine);
	}
	return [...byMaterial].map(([materialId, byLine]) => ({
		materialId,
		required: [...byLine.values()].reduce((sum, pieces) => sum + pieces, 0),
		available: stock.get(materialId) ?? 0,
		byLine: [...byLine].sort(([a], [b]) => a - b).map(([line, pieces]) => ({ line, pieces }))
	}));
}
