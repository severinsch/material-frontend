import type { Kit, KitGroupOption } from '#lib/api/index.js';

/** A line of the packing list: a kit, how many of it, and the amount chosen per group. */
export interface KitSelection {
	kit: Kit;
	quantity: number;
	/** Index into the group's `amounts` per group index; missing entries mean the default, 0. */
	choices: readonly number[];
}

/** Pieces of a variant packed for a group of a line. */
export interface Assignment {
	/** Index of the line in the selections. */
	line: number;
	groupIndex: number;
	materialId: string;
	/**
	 * The variant the pieces are taken from. Null only for missing pieces of an option that accepts any of several
	 * variants, since no variant is left to take them from.
	 */
	variantId: string | null;
	/** Whether the pieces were assigned through an option that accepts any of the material's several variants. */
	anyVariant: boolean;
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

/**
 * Pieces to pack of one variant, or of any variant of a material with several ("Seil (beliebig)"). Pieces of a
 * material with a single variant are always needs of that variant.
 */
export interface MaterialNeed {
	materialId: string;
	/** The variant, or null for pieces taken through options that accept any variant. */
	variantId: string | null;
	/** Pieces to pack, including pieces that are missing. */
	required: number;
	/** Pieces that the stock can't provide. */
	missing: number;
	/**
	 * Usable pieces: the variant's stock, or for any variant the material's stock minus the pieces the needs of its
	 * specific variants take.
	 */
	available: number;
	/** The variants the pieces are taken from, in the order of the material's variants (the variant itself, or none). */
	variantIds: string[];
	/** Pieces per line, in the order of the lines. */
	byLine: { line: number; pieces: number }[];
}

/** The units a group of [selection] needs for one kit, by the chosen amount. */
export function unitsOf(selection: Omit<KitSelection, 'quantity'>, groupIndex: number): number {
	const { amounts } = selection.kit.groups[groupIndex];
	return (amounts[selection.choices[groupIndex] ?? 0] ?? amounts[0])?.requiredUnits ?? 0;
}

/** The variants an option accepts: its variant, or all variants of its material. */
function candidatesOf(
	option: Pick<KitGroupOption, 'materialId' | 'variantId'>,
	variants: ReadonlyMap<string, readonly string[]>
): readonly string[] {
	return option.variantId ? [option.variantId] : (variants.get(option.materialId) ?? []);
}

/**
 * Distributes the available stock over the groups of the selected lines.
 *
 * Every group of a line needs the units of its chosen amount times the line's quantity; groups with 0 units are
 * skipped. An option for any variant of a material stands for all its variants with the same unit value and
 * priority, taking the variant with the most stock left first. Groups whose options cover fewer variants are served
 * first, since they have fewer alternatives (a group that needs "Seil 20 m" comes before one that takes any rope).
 * Every group then takes its options in priority order (lowest first): first only whole pieces that fit into the
 * remaining units, then rounding up to cover the rest, so a large piece isn't used where smaller ones fit exactly. If
 * the stock runs out, the missing pieces are assigned to the group's preferred option (marked as missing), so the
 * shortage shows up there, and the missing units are reported per group so they can be filled with any of its
 * options. This is a greedy approach: it doesn't search for the best possible combination, which is fine for the
 * small number of interchangeable materials in practice.
 *
 * @param stock usable pieces per variant id
 * @param variants the variant ids of each material, by material id
 */
export function allocate(
	selections: KitSelection[],
	stock: ReadonlyMap<string, number>,
	variants: ReadonlyMap<string, readonly string[]>
): Allocation {
	const demands = selections.flatMap((selection, line) =>
		selection.kit.groups.flatMap((group, groupIndex) => {
			const units = unitsOf(selection, groupIndex) * selection.quantity;
			if (units <= 0) return [];
			const options = group.options
				.toSorted((a, b) => a.priority - b.priority)
				.map((option) => ({ ...option, candidates: candidatesOf(option, variants) }));
			const covered = new Set(options.flatMap((option) => option.candidates)).size;
			return [{ line, groupIndex, units, options, covered }];
		})
	);
	demands.sort((a, b) => a.covered - b.covered);

	const left = new Map(stock);
	const leftOf = (variantId: string) => left.get(variantId) ?? 0;
	const assignments: Assignment[] = [];
	const shortages: GroupShortage[] = [];
	for (const { line, groupIndex, units, options } of demands) {
		let remaining = units;
		for (const round of [Math.floor, Math.ceil]) {
			for (const option of options) {
				const anyVariant = !option.variantId && option.candidates.length > 1;
				// Sorted when the option's turn comes, by what earlier groups and options left.
				for (const variantId of option.candidates.toSorted((a, b) => leftOf(b) - leftOf(a))) {
					if (remaining <= 0) break;
					const pieces = Math.min(round(remaining / option.unitValue), leftOf(variantId));
					if (pieces <= 0) continue;
					left.set(variantId, leftOf(variantId) - pieces);
					const { materialId } = option;
					assignments.push({
						line,
						groupIndex,
						materialId,
						variantId,
						anyVariant,
						pieces,
						missing: false
					});
					remaining -= pieces * option.unitValue;
				}
			}
		}
		if (remaining > 0) {
			const [preferred] = options;
			const [only] = preferred.candidates.length === 1 ? preferred.candidates : [];
			assignments.push({
				line,
				groupIndex,
				materialId: preferred.materialId,
				variantId: only ?? null,
				anyVariant: !preferred.variantId && preferred.candidates.length > 1,
				pieces: Math.ceil(remaining / preferred.unitValue),
				missing: true
			});
			shortages.push({ line, groupIndex, missingUnits: remaining });
		}
	}
	return { assignments, shortages };
}

/**
 * What to pack: the [assignments] summed per variant, and per material for pieces assigned through options that
 * accept any of its variants, in the order they first appear, and broken down by line.
 *
 * @param stock usable pieces per variant id
 * @param variants the variant ids of each material, by material id
 */
export function needsOf(
	assignments: Assignment[],
	stock: ReadonlyMap<string, number>,
	variants: ReadonlyMap<string, readonly string[]>
): MaterialNeed[] {
	type Sum = Omit<MaterialNeed, 'available' | 'byLine'> & { lines: Map<number, number> };
	const needs = new Map<string, Sum>(); // material and variant (or "*" for any) → pieces
	for (const { materialId, variantId, anyVariant, line, pieces, missing } of assignments) {
		const key = anyVariant ? `${materialId}/*` : `${materialId}/${variantId}`;
		let need = needs.get(key);
		if (!need) {
			need = {
				materialId,
				variantId: anyVariant ? null : variantId,
				required: 0,
				missing: 0,
				variantIds: [],
				lines: new Map()
			};
			needs.set(key, need);
		}
		need.required += pieces;
		if (missing) need.missing += pieces;
		else if (variantId && !need.variantIds.includes(variantId)) need.variantIds.push(variantId);
		need.lines.set(line, (need.lines.get(line) ?? 0) + pieces);
	}

	const all = [...needs.values()];
	return all.map(({ lines, ...need }) => {
		const ofMaterial = variants.get(need.materialId) ?? [];
		let available: number;
		if (need.variantId) {
			available = stock.get(need.variantId) ?? 0;
		} else {
			const total = ofMaterial.reduce((sum, id) => sum + (stock.get(id) ?? 0), 0);
			const takenBySpecific = all
				.filter((other) => other.materialId === need.materialId && other.variantId)
				.reduce((sum, other) => sum + other.required - other.missing, 0);
			available = Math.max(0, total - takenBySpecific);
		}
		return {
			...need,
			available,
			variantIds: need.variantIds.toSorted((a, b) => ofMaterial.indexOf(a) - ofMaterial.indexOf(b)),
			byLine: [...lines].sort(([a], [b]) => a - b).map(([line, pieces]) => ({ line, pieces }))
		};
	});
}
