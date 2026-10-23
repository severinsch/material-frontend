import type { Kit, KitGroup, KitGroupOption } from '#lib/api/index.js';

/** A line of the packing list: a kit, how many of it, and the amount chosen per group. */
export interface KitSelection {
	kit: Kit;
	quantity: number;
	/** Index into the group's `amounts` per group index; missing entries mean the default, 0. */
	choices: readonly number[];
	/**
	 * The option a group is pinned to, by its [optionId], per group index; null or missing entries mean automatic.
	 * Only active pins count, see [activePins].
	 */
	pins?: readonly (string | null | undefined)[];
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

/**
 * The id pins use for [option]: its variant id, or its material id for an option that accepts any variant. Unique
 * within a group, and unlike the option's position it survives options being added or reprioritized.
 */
export function optionId(option: Pick<KitGroupOption, 'materialId' | 'variantId'>): string {
	return option.variantId ?? option.materialId;
}

/** The options of [group] in priority order; options with the same priority keep the API's order. */
export function sortedOptions(group: KitGroup): KitGroupOption[] {
	return group.options.toSorted((a, b) => a.priority - b.priority);
}

/**
 * The option each group of [selection] is pinned to, or undefined for automatic. A pin counts only if it names one of
 * the group's several options and the chosen amount isn't 0; others are kept on the line (choosing "mit" again
 * restores a pin of the windows) but ignored.
 */
export function activePins(
	selection: Omit<KitSelection, 'quantity'>
): (KitGroupOption | undefined)[] {
	return selection.kit.groups.map((group, groupIndex) => {
		const pin = selection.pins?.[groupIndex];
		if (!pin || !isPinnable(selection, groupIndex)) return undefined;
		return group.options.find((option) => optionId(option) === pin);
	});
}

/** Whether a group of [selection] can be pinned: it has several options and is packed (not "ohne"). */
export function isPinnable(selection: Omit<KitSelection, 'quantity'>, groupIndex: number): boolean {
	return selection.kit.groups[groupIndex].options.length > 1 && unitsOf(selection, groupIndex) > 0;
}

/** The variants an option accepts: its variant, or all variants of its material. */
function candidatesOf(
	option: Pick<KitGroupOption, 'materialId' | 'variantId'>,
	variants: ReadonlyMap<string, readonly string[]>
): readonly string[] {
	return option.variantId ? [option.variantId] : (variants.get(option.materialId) ?? []);
}

interface Option extends KitGroupOption {
	candidates: readonly string[];
	/** Dense rank of the option's priority within its group, 0 for the most preferred. */
	rank: number;
}

/** The units a group of a line needs, and the options it may use: all of them, or the pinned one. */
interface Demand {
	line: number;
	groupIndex: number;
	units: number;
	/** In priority order. */
	options: Option[];
}

/** Variants that every demand treats alike (same unit value and rank, or not at all), pooled with their stock. */
interface VariantClass {
	variantIds: string[];
	stock: number;
	/** Per accepting demand (by index), the unit value and rank of the option that accepts the variants. */
	uses: { demand: number; unitValue: number; rank: number }[];
}

/**
 * Distributes the available stock over the groups of the selected lines.
 *
 * Every group of a line needs the units of its chosen amount times the line's quantity (groups with 0 units are
 * skipped), filled by its options, or only by the pinned one. An option for any variant of a material stands for all
 * its variants. Of all ways to distribute the stock, the allocation takes the best by, in this order:
 * 1. the fewest missing units, summed over the groups (where a material counts differently in two groups, a piece
 *    goes where it counts more);
 * 2. the least waste, units packed beyond what a group needs, so a large piece isn't used where smaller ones fit;
 * 3. the fewest units (pieces × unit value) from options other than a group's most preferred ones, then from
 *    options below its two most preferred priorities, and so on; options with the same priority count the same;
 * 4. earlier lines first, then the kit's group order.
 * Among variants every group treats alike, the one with the most stock left is taken first. A shortage is thus only
 * reported if no distribution covers everything; the missing pieces are assigned to the group's preferred (or
 * pinned) option, so the shortage shows up there, and the missing units are reported per group. Since the result
 * depends on the whole selection, adding a kit can change what an earlier one gets.
 *
 * The search is exact: variants treated alike by every group are pooled into classes, and groups that share no class
 * are searched separately. If every group's best fill on its own fits into the stock, that's the result; otherwise a
 * depth-first search over the groups, memoized on the stock left, skips fills that can't beat the best found so far.
 *
 * @param stock usable pieces per variant id
 * @param variants the variant ids of each material, by material id
 */
export function allocate(
	selections: KitSelection[],
	stock: ReadonlyMap<string, number>,
	variants: ReadonlyMap<string, readonly string[]>
): Allocation {
	const demands = demandsOf(selections, variants);
	const classes = classesOf(demands, stock);
	const assigned: Assignment[][] = demands.map(() => []);
	const shortages: (GroupShortage | undefined)[] = [];
	const left = new Map(stock);
	for (const component of componentsOf(demands, classes)) {
		const result = search(component, demands, classes);
		component.demands.forEach((d, k) => {
			const demand = demands[d];
			for (const [c, pieces] of result.pieces[k]) {
				takeFromClass(demand, d, classes[component.classes[c]], pieces, left, assigned);
			}
			if (result.missing[k] > 0) addMissing(demand, d, result.missing[k], assigned, shortages);
		});
	}
	return {
		assignments: assigned.flat(),
		shortages: shortages.filter((shortage) => shortage !== undefined)
	};
}

function demandsOf(
	selections: KitSelection[],
	variants: ReadonlyMap<string, readonly string[]>
): Demand[] {
	return selections.flatMap((selection, line) => {
		const pins = activePins(selection);
		return selection.kit.groups.flatMap((group, groupIndex) => {
			const units = unitsOf(selection, groupIndex) * selection.quantity;
			if (units <= 0) return [];
			const pinned = pins[groupIndex];
			const sorted = pinned ? [pinned] : sortedOptions(group);
			const priorities = [...new Set(sorted.map((option) => option.priority))];
			const options = sorted.map((option) => ({
				...option,
				candidates: candidatesOf(option, variants),
				rank: priorities.indexOf(option.priority)
			}));
			return [{ line, groupIndex, units, options }];
		});
	});
}

/** Pools the variants [demands] accept into classes, by how every demand treats them. */
function classesOf(demands: Demand[], stock: ReadonlyMap<string, number>): VariantClass[] {
	const usesOf = new Map<string, VariantClass['uses']>();
	demands.forEach(({ options }, demand) => {
		for (const { candidates, unitValue, rank } of options) {
			for (const variantId of candidates) {
				let uses = usesOf.get(variantId);
				if (!uses) usesOf.set(variantId, (uses = []));
				// Only the first option of a group that accepts a variant counts (kits allow just one).
				if (uses.at(-1)?.demand !== demand) uses.push({ demand, unitValue, rank });
			}
		}
	});
	const classes = new Map<string, VariantClass>();
	for (const [variantId, uses] of usesOf) {
		const signature = uses.map((use) => `${use.demand}:${use.unitValue}:${use.rank}`).join(',');
		let variantClass = classes.get(signature);
		if (!variantClass) classes.set(signature, (variantClass = { variantIds: [], stock: 0, uses }));
		variantClass.variantIds.push(variantId);
		variantClass.stock += stock.get(variantId) ?? 0;
	}
	return [...classes.values()];
}

/** Demands that share stock, with their classes, by index; in the order of their first demand. */
interface Component {
	demands: number[];
	classes: number[];
}

function componentsOf(demands: Demand[], classes: VariantClass[]): Component[] {
	const parent = demands.map((_, d) => d);
	const root = (d: number): number => (parent[d] === d ? d : (parent[d] = root(parent[d])));
	for (const { uses } of classes) {
		for (const use of uses.slice(1)) parent[root(use.demand)] = root(uses[0].demand);
	}
	const components = new Map<number, Component>();
	demands.forEach((_, d) => {
		const r = root(d);
		let component = components.get(r);
		if (!component) components.set(r, (component = { demands: [], classes: [] }));
		component.demands.push(d);
	});
	classes.forEach(({ uses }, c) => {
		if (uses.length > 0) components.get(root(uses[0].demand))?.classes.push(c);
	});
	return [...components.values()];
}

/** Pieces per class (by the component's class index) and missing units, per demand of the component. */
interface SearchResult {
	pieces: [classIndex: number, pieces: number][][];
	missing: number[];
}

interface Fill {
	/** Missing units, waste, then the units at rank 1 or worse, rank 2 or worse, and so on. */
	cost: number[];
	pieces: number[];
	missing: number;
}

/** Searches the best fills for the demands of [component] (see [allocate]). */
function search(component: Component, demands: Demand[], classes: VariantClass[]): SearchResult {
	const n = component.demands.length;
	// The classes each demand can use, in the order fills try them: preferred, larger pieces, more stock. The order
	// must not depend on the stock left, since the memo below shares results between different paths.
	const classUses = component.demands.map((d) =>
		component.classes
			.flatMap((c, local) => {
				const use = classes[c].uses.find((u) => u.demand === d);
				return use
					? [{ local, unitValue: use.unitValue, rank: use.rank, stock: classes[c].stock }]
					: [];
			})
			.sort((a, b) => a.rank - b.rank || b.unitValue - a.unitValue || b.stock - a.stock)
	);
	const units = component.demands.map((d) => demands[d].units);
	const width = 2 + Math.max(0, ...classUses.flat().map((use) => use.rank));
	const zero = new Array<number>(width).fill(0);
	const stock = component.classes.map((c) => classes[c].stock);

	/**
	 * The best fill of demand [k] with the stock [left] per class (restored before returning). [rest] gives the cost of
	 * the best fills of the following demands for the stock a fill leaves, and [restBound] is a lower bound of it;
	 * without them, the fill is the best for the demand on its own. Fills are tried in a fixed order and the first of
	 * equally good ones wins; fills that can't beat the best one found so far are skipped.
	 */
	const bestFill = (
		k: number,
		left: number[],
		rest?: (left: number[]) => number[],
		restBound = zero
	): Fill => {
		const uses = classUses[k];
		const pieces = uses.map(() => 0);
		// A lower bound of the cost of any fill completing the current one: the rest's bound plus the units at each
		// rank so far, plus (set while checking) the units that the remaining classes can't fill.
		const bound = [...restBound];
		const own = new Array<number>(width);
		let found: Fill | undefined;
		const visit = (i: number, remaining: number) => {
			if (found) {
				let reachable = 0;
				for (let j = i; j < uses.length; j++) reachable += left[uses[j].local] * uses[j].unitValue;
				bound[0] = restBound[0] + Math.max(0, remaining - reachable);
				const hopeless = !isLessSum(bound, zero, found.cost);
				bound[0] = restBound[0];
				if (hopeless) return;
			}
			if (i === uses.length || remaining <= 0) {
				const restCost = rest ? rest(left) : zero;
				own.fill(0);
				own[0] = Math.max(0, remaining);
				own[1] = Math.max(0, -remaining);
				uses.forEach(({ rank, unitValue }, j) => {
					for (let r = 1; r <= rank; r++) own[1 + r] += pieces[j] * unitValue;
				});
				if (!found || isLessSum(own, restCost, found.cost)) {
					const cost = own.map((value, index) => value + restCost[index]);
					found = { cost, pieces: [...pieces], missing: own[0] };
				}
				return;
			}
			const { local, unitValue, rank } = uses[i];
			// More than this would leave a piece that isn't needed to cover the group.
			for (let p = Math.min(left[local], Math.ceil(remaining / unitValue)); p >= 0; p--) {
				pieces[i] = p;
				left[local] -= p;
				for (let r = 1; r <= rank; r++) bound[1 + r] += p * unitValue;
				visit(i + 1, remaining - p * unitValue);
				for (let r = 1; r <= rank; r++) bound[1 + r] -= p * unitValue;
				left[local] += p;
			}
			pieces[i] = 0;
		};
		visit(0, units[k]);
		return found!;
	};

	const resultOf = (fills: Fill[]): SearchResult => ({
		pieces: fills.map((fill, k) =>
			classUses[k].flatMap(({ local }, j) =>
				fill.pieces[j] > 0 ? [[local, fill.pieces[j]] as [number, number]] : []
			)
		),
		missing: fills.map((fill) => fill.missing)
	});

	// Each demand's best fill on its own. If they fit into the stock together, that's the best for all, and the
	// one the search would find (the usual case with enough stock). Otherwise their costs bound the search.
	const alone = classUses.map((_, k) => bestFill(k, stock));
	const taken = stock.map(() => 0);
	alone.forEach((fill, k) =>
		classUses[k].forEach(({ local }, j) => (taken[local] += fill.pieces[j]))
	);
	if (taken.every((pieces, c) => pieces <= stock[c])) return resultOf(alone);
	const bounds = [zero];
	for (let k = n - 1; k >= 0; k--) {
		bounds.unshift(bounds[0].map((value, index) => value + alone[k].cost[index]));
	}

	// Stock beyond what the remaining demands could take makes no difference, so the memo key caps it.
	const caps = Array.from({ length: n + 1 }, () => stock.map(() => 0));
	for (let k = n - 1; k >= 0; k--) {
		caps[k] = [...caps[k + 1]];
		for (const use of classUses[k]) caps[k][use.local] += Math.ceil(units[k] / use.unitValue);
	}
	const radices = caps.map((cap) => {
		let product = 1;
		const radix = cap.map((max) => {
			const value = product;
			product *= max + 1;
			return value;
		});
		return product <= Number.MAX_SAFE_INTEGER ? radix : undefined;
	});
	const keyOf = (k: number, left: number[]): number | string => {
		const radix = radices[k];
		if (!radix) return left.map((value, c) => Math.min(value, caps[k][c])).join(',');
		return left.reduce((key, value, c) => key + Math.min(value, caps[k][c]) * radix[c], 0);
	};
	const memo = Array.from({ length: n }, () => new Map<number | string, Fill>());
	const none: Fill = { cost: zero, pieces: [], missing: 0 };
	const best = (k: number, left: number[]): Fill => {
		if (k === n) return none;
		const key = keyOf(k, left);
		const cached = memo[k].get(key);
		if (cached) return cached;
		const found = bestFill(k, left, (rest) => best(k + 1, rest).cost, bounds[k + 1]);
		memo[k].set(key, found);
		return found;
	};

	const left = [...stock];
	const fills: Fill[] = [];
	for (let k = 0; k < n; k++) {
		const fill = best(k, left);
		classUses[k].forEach(({ local }, j) => (left[local] -= fill.pieces[j]));
		fills.push(fill);
	}
	return resultOf(fills);
}

/** Whether [a] + [b] is lexicographically less than [than]. */
function isLessSum(a: number[], b: number[], than: number[]): boolean {
	for (let i = 0; i < than.length; i++) {
		const sum = a[i] + b[i];
		if (sum !== than[i]) return sum < than[i];
	}
	return false;
}

/**
 * Takes [pieces] of [variantClass] for [demand], from the variants with the most stock left first, each through the
 * demand's option that accepts it.
 */
function takeFromClass(
	demand: Demand,
	d: number,
	variantClass: VariantClass,
	pieces: number,
	left: Map<string, number>,
	assigned: Assignment[][]
) {
	const leftOf = (variantId: string) => left.get(variantId) ?? 0;
	let remaining = pieces;
	for (const variantId of variantClass.variantIds.toSorted((a, b) => leftOf(b) - leftOf(a))) {
		if (remaining <= 0) break;
		const taken = Math.min(remaining, leftOf(variantId));
		if (taken <= 0) continue;
		left.set(variantId, leftOf(variantId) - taken);
		remaining -= taken;
		const option = demand.options.find((o) => o.candidates.includes(variantId))!;
		assigned[d].push(assignment(demand, option, variantId, taken, false));
	}
}

function assignment(
	{ line, groupIndex }: Demand,
	option: Option,
	variantId: string | null,
	pieces: number,
	missing: boolean
): Assignment {
	const anyVariant = !option.variantId && option.candidates.length > 1;
	return {
		line,
		groupIndex,
		materialId: option.materialId,
		variantId,
		anyVariant,
		pieces,
		missing
	};
}

/** Assigns [units] the stock can't fill to the preferred option of [demand], as missing pieces. */
function addMissing(
	demand: Demand,
	d: number,
	units: number,
	assigned: Assignment[][],
	shortages: (GroupShortage | undefined)[]
) {
	const [preferred] = demand.options;
	const [only] = preferred.candidates.length === 1 ? preferred.candidates : [];
	const pieces = Math.ceil(units / preferred.unitValue);
	assigned[d].push(assignment(demand, preferred, only ?? null, pieces, true));
	shortages[d] = { line: demand.line, groupIndex: demand.groupIndex, missingUnits: units };
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
