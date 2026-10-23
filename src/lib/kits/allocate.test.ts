import { describe, expect, it } from 'vitest';
import type { Kit, KitGroup } from '#lib/api/index.js';
import { activePins, allocate, needsOf, unitsOf, type KitSelection } from './allocate.js';

// Variant ids are the material id, followed by the variant's name for materials with several ("seil 20"). An option
// "seil" accepts any variant of the material, "seil 20" only that one.

const materialOf = (variantId: string) => variantId.split(' ')[0];

/**
 * A group with the given options, whose priority is their position unless given; [amounts] are units, or label and
 * units for several amounts.
 */
function group(
	options: [option: string, unitValue?: number, priority?: number][],
	...amounts: (number | [label: string, units: number])[]
): KitGroup {
	return {
		amounts: amounts.map((amount) =>
			typeof amount === 'number'
				? { label: null, requiredUnits: amount }
				: { label: amount[0], requiredUnits: amount[1] }
		),
		options: options.map(([option, unitValue = 1, priority], index) => ({
			materialId: materialOf(option),
			variantId: option.includes(' ') ? option : null,
			unitValue,
			priority: priority ?? index
		}))
	};
}

function kit(id: string, ...groups: KitGroup[]): Kit {
	return { id, name: id, groups };
}

function select(
	kit: Kit,
	quantity = 1,
	choices: number[] = [],
	pins: (string | null)[] = []
): KitSelection {
	return { kit, quantity, choices, pins };
}

/** The stock by variant id, and the variants of each material, which are the variants in [stock]. */
function stockOf(stock: Record<string, number>) {
	const variants = Map.groupBy(Object.keys(stock), materialOf);
	return [new Map(Object.entries(stock)), variants] as const;
}

function run(selections: KitSelection[], stock: Record<string, number>, budget?: number) {
	return allocate(selections, ...stockOf(stock), budget);
}

function needs(selections: KitSelection[], stock: Record<string, number>) {
	return needsOf(run(selections, stock).assignments, ...stockOf(stock));
}

/** Required pieces per need: by variant id, or "seil *" for any variant of "seil". */
function required(selections: KitSelection[], stock: Record<string, number>) {
	return Object.fromEntries(
		needs(selections, stock).map((need) => [
			need.variantId ?? `${need.materialId} *`,
			need.required
		])
	);
}

const optional = (units: number): [string, number][] => [
	['ohne', 0],
	['mit', units]
];

describe('allocate', () => {
	it('multiplies groups with the quantity', () => {
		const jurte = kit('jurte', group([['hering']], 30));
		expect(required([select(jurte, 2)], { hering: 100 })).toEqual({ hering: 60 });
	});

	it('uses options by priority and falls back when the stock runs out', () => {
		const roof = kit('jurte', group([['halbdach', 3], ['kohtenblatt']], 6));
		expect(required([select(roof)], { halbdach: 10, kohtenblatt: 10 })).toEqual({ halbdach: 2 });
		expect(required([select(roof)], { halbdach: 1, kohtenblatt: 10 })).toEqual({
			halbdach: 1,
			kohtenblatt: 3
		});
	});

	it("doesn't use a large piece where smaller ones fit exactly", () => {
		const options: [string, number?][] = [['halbdach', 3], ['kohtenblatt']];
		const a = kit('a', group(options, 4));
		const b = kit('b', group(options, 3));
		expect(required([select(a), select(b)], { halbdach: 2, kohtenblatt: 1 })).toEqual({
			halbdach: 2,
			kohtenblatt: 1
		});
		// Without smaller pieces, the remainder is still covered by rounding up.
		expect(required([select(a)], { halbdach: 2 })).toEqual({ halbdach: 2 });
	});

	it('assigns missing pieces to the preferred option', () => {
		const roof = kit('jurte', group([['halbdach', 3], ['kohtenblatt']], 6));
		const { assignments } = run([select(roof)], { halbdach: 1, kohtenblatt: 0 });
		const halbdach = { materialId: 'halbdach', variantId: 'halbdach', anyVariant: false };
		expect(assignments).toEqual([
			{ line: 0, groupIndex: 0, ...halbdach, pieces: 1, missing: false },
			{ line: 0, groupIndex: 0, ...halbdach, pieces: 1, missing: true }
		]);
		expect(needs([select(roof)], { halbdach: 1, kohtenblatt: 0 })).toEqual([
			{
				materialId: 'halbdach',
				variantId: 'halbdach',
				required: 2,
				missing: 1,
				available: 1,
				variantIds: ['halbdach'],
				byLine: [{ line: 0, pieces: 2 }]
			}
		]);
	});

	it('packs the chosen amount, the first one by default', () => {
		const jurte = kit('jurte', group([['stange']], ['Einbein', 1], ['Dreibein', 3]));
		expect(required([select(jurte, 2)], { stange: 10 })).toEqual({ stange: 2 });
		expect(required([select(jurte, 2, [1])], { stange: 10 })).toEqual({ stange: 6 });
		// An unknown choice falls back to the default.
		expect(required([select(jurte, 1, [5])], { stange: 10 })).toEqual({ stange: 1 });
	});

	it('skips groups with 0 units', () => {
		const jurte = kit('jurte', group([['hering']], 30), group([['fenster']], ...optional(8)));
		expect(required([select(jurte)], { hering: 30, fenster: 8 })).toEqual({ hering: 30 });
		expect(required([select(jurte, 1, [0, 1])], { hering: 30, fenster: 8 })).toEqual({
			hering: 30,
			fenster: 8
		});
		expect(run([select(jurte)], { hering: 0, fenster: 0 }).shortages).toEqual([
			{ line: 0, groupIndex: 0, missingUnits: 30 }
		]);
	});

	it('allocates several lines of the same kit with different choices', () => {
		const jurte = kit('jurte', group([['stange']], ['Einbein', 1], ['Dreibein', 3]));
		const lines = [select(jurte, 2), select(jurte, 1, [1])];
		expect(needs(lines, { stange: 4 })).toEqual([
			{
				materialId: 'stange',
				variantId: 'stange',
				required: 5,
				missing: 1,
				available: 4,
				variantIds: ['stange'],
				byLine: [
					{ line: 0, pieces: 2 },
					{ line: 1, pieces: 3 }
				]
			}
		]);
		expect(run(lines, { stange: 4 }).shortages).toEqual([
			{ line: 1, groupIndex: 0, missingUnits: 1 }
		]);
	});

	it('serves groups without alternatives first', () => {
		const flexible = kit('flexible', group([['kohtenblatt'], ['plane']], 4));
		const fixed = kit('fixed', group([['kohtenblatt']], 4));
		expect(required([select(flexible), select(fixed)], { kohtenblatt: 4, plane: 4 })).toEqual({
			kohtenblatt: 4,
			plane: 4
		});
	});

	it('breaks needs down by line', () => {
		const a = kit('a', group([['hering']], 10));
		const b = kit('b', group([['hering']], 20));
		const [need] = needs([select(a), select(b)], { hering: 100 });
		expect(need.byLine).toEqual([
			{ line: 0, pieces: 10 },
			{ line: 1, pieces: 20 }
		]);
	});

	it('reports missing units per line and group', () => {
		const jurte = kit(
			'jurte',
			group([['hering']], 30),
			group([['halbdach', 3], ['kohtenblatt']], 6),
			group([['fenster']], ...optional(8))
		);
		const { shortages } = run([select(jurte, 2, [0, 0, 1])], {
			hering: 60,
			halbdach: 2,
			kohtenblatt: 1,
			fenster: 16
		});
		// 12 roof units needed, 2 halves and 1 sheet fill 7.
		expect(shortages).toEqual([{ line: 0, groupIndex: 1, missingUnits: 5 }]);
	});

	it('reports no shortages when the stock suffices', () => {
		const jurte = kit('jurte', group([['hering']], 30));
		expect(run([select(jurte)], { hering: 30 }).shortages).toEqual([]);
	});
});

describe('allocate with variants', () => {
	it('takes any variant, the one with the most stock first', () => {
		const kohte = kit('kohte', group([['seil']], 6));
		expect(required([select(kohte)], { 'seil 10': 2, 'seil 15': 4, 'seil 20': 3 })).toEqual({
			'seil *': 6
		});
		const { assignments } = run([select(kohte)], { 'seil 10': 2, 'seil 15': 4, 'seil 20': 3 });
		expect(assignments.map((a) => [a.variantId, a.pieces, a.anyVariant])).toEqual([
			['seil 15', 4, true],
			['seil 20', 2, true]
		]);
	});

	it('serves specific variants before groups that take any', () => {
		const any = kit('any', group([['seil']], 3));
		const specific = kit('specific', group([['seil 20']], 2));
		const stock = { 'seil 10': 1, 'seil 20': 4 };
		// The group that takes any rope comes first, but would use up the 20 m ropes the other one needs.
		expect(run([select(any), select(specific)], stock).shortages).toEqual([]);
		expect(required([select(any), select(specific)], stock)).toEqual({
			'seil *': 3,
			'seil 20': 2
		});
	});

	it('lists any variant without the pieces of specific ones', () => {
		const any = kit('any', group([['seil']], 4));
		const specific = kit('specific', group([['seil 20']], 2));
		const [twenty, rest] = needs([select(specific), select(any)], {
			'seil 10': 3,
			'seil 15': 2,
			'seil 20': 3
		});
		expect(twenty).toMatchObject({ variantId: 'seil 20', required: 2, available: 3 });
		// 8 ropes, 2 of them packed as 20 m. The other 4 are 3× 10 m (most left) and 1× 15 m.
		expect(rest).toMatchObject({
			variantId: null,
			required: 4,
			missing: 0,
			available: 6,
			variantIds: ['seil 10', 'seil 15']
		});
	});

	it('counts missing pieces of any variant on the material', () => {
		const kohte = kit('kohte', group([['seil']], 5));
		expect(needs([select(kohte)], { 'seil 10': 1, 'seil 15': 2 })).toEqual([
			{
				materialId: 'seil',
				variantId: null,
				required: 5,
				missing: 2,
				available: 3,
				variantIds: ['seil 10', 'seil 15'],
				byLine: [{ line: 0, pieces: 5 }]
			}
		]);
	});

	it('treats any variant of a material with a single variant as that variant', () => {
		const a = kit('a', group([['hering']], 10));
		const b = kit('b', group([['hering hering']], 5));
		expect(required([select(a), select(b)], { 'hering hering': 20 })).toEqual({
			'hering hering': 15
		});
	});

	it('expands any variant together with other options', () => {
		const roof = kit('roof', group([['plane'], ['blatt']], 4));
		expect(required([select(roof)], { 'plane ohne': 1, 'plane latz': 2, blatt: 5 })).toEqual({
			'plane *': 3,
			blatt: 1
		});
	});
});

describe('exact allocation', () => {
	it('avoids a shortage that taking the preferred option first would cause', () => {
		const jurte = kit('jurte', group([['plane'], ['halbdach', 3]], 6));
		const kohte = kit('kohte', group([['plane'], ['blatt']], 6));
		const stock = { plane: 6, halbdach: 2, blatt: 0 };
		const lines = [select(jurte), select(kohte)];
		expect(run(lines, stock)).toMatchObject({ shortages: [], approximate: false });
		expect(required(lines, stock)).toEqual({ halbdach: 2, plane: 6 });
	});

	it('covers the case of FE-7 with the demo stock', () => {
		// The Jurte's roof prefers Kohtenplanen; the Kohten take only the plain ones.
		const jurte = kit('jurte', group([['plane std'], ['plane latz'], ['halbdach', 3]], 6));
		const kohte = kit('kohte', group([['plane std']], 4));
		const stock = { 'plane std': 8, 'plane latz': 4, halbdach: 2 };
		const lines = [select(jurte), select(kohte, 2)];
		expect(run(lines, stock).shortages).toEqual([]);
		// 3 with Latz and a Halbdach fill the roof exactly.
		expect(required(lines, stock)).toEqual({ 'plane latz': 3, halbdach: 1, 'plane std': 8 });
	});

	it('prefers fewer missing units over less waste', () => {
		const a = kit('a', group([['halbdach', 3], ['blatt']], 2));
		const b = kit('b', group([['blatt']], 2));
		// 2 Blätter would fit a exactly, but b needs them; a Halbdach covers a with 1 unit to spare.
		const lines = [select(a), select(b)];
		expect(run(lines, { halbdach: 1, blatt: 2 }).shortages).toEqual([]);
		expect(required(lines, { halbdach: 1, blatt: 2 })).toEqual({ halbdach: 1, blatt: 2 });
	});

	it('prefers less waste over preferred options', () => {
		const roof = kit('roof', group([['halbdach', 3], ['blatt']], 4));
		expect(required([select(roof)], { halbdach: 5, blatt: 5 })).toEqual({ halbdach: 1, blatt: 1 });
	});

	it('prefers preferred options over the line order', () => {
		const a = kit('a', group([['x'], ['y']], 1));
		const b = kit('b', group([['x'], ['z'], ['y']], 1));
		// a could take x as the first line, but then b would need its third choice.
		const { assignments } = run([select(a), select(b)], { x: 1, y: 1, z: 0 });
		expect(assignments.map((a) => [a.line, a.variantId])).toEqual([
			[0, 'y'],
			[1, 'x']
		]);
	});

	it('gives the preferred option to the earlier line on a tie', () => {
		const roof = kit('roof', group([['halbdach', 3], ['blatt']], 3));
		const { assignments } = run([select(roof), select(roof)], { halbdach: 1, blatt: 3 });
		expect(assignments.map((a) => [a.line, a.variantId, a.pieces])).toEqual([
			[0, 'halbdach', 1],
			[1, 'blatt', 3]
		]);
	});

	it('treats options with the same priority alike, taking the most stock first', () => {
		const kohte = kit(
			'kohte',
			group(
				[
					['seil 20', 1, 0],
					['seil 10', 1, 0]
				],
				3
			)
		);
		expect(required([select(kohte)], { 'seil 10': 8, 'seil 20': 5 })).toEqual({ 'seil 10': 3 });
		// Options of different materials alike come back as their own options.
		const roof = kit(
			'roof',
			group(
				[
					['plane', 1, 0],
					['blatt', 1, 0]
				],
				5
			)
		);
		const { assignments } = run([select(roof)], { plane: 3, blatt: 3 });
		expect(assignments.map((a) => [a.materialId, a.variantId, a.pieces])).toEqual([
			['plane', 'plane', 3],
			['blatt', 'blatt', 2]
		]);
	});

	it('ignores stock that no group takes', () => {
		const jurte = kit('jurte', group([['hering']], 10));
		expect(run([select(jurte)], { hering: 10, spaten: 3 }).assignments).toHaveLength(1);
	});

	it('reports options without variants as missing', () => {
		const jurte = kit('jurte', group([['geist']], 2));
		expect(run([select(jurte)], {})).toEqual({
			assignments: [
				{
					line: 0,
					groupIndex: 0,
					materialId: 'geist',
					variantId: null,
					anyVariant: false,
					pieces: 2,
					missing: true
				}
			],
			shortages: [{ line: 0, groupIndex: 0, missingUnits: 2 }],
			approximate: false
		});
	});

	it('marks a greedy allocation approximate only if it has a shortage', () => {
		const roof = kit('roof', group([['halbdach', 3], ['blatt']], 6));
		expect(run([select(roof)], { halbdach: 2, blatt: 6 }, 0)).toMatchObject({
			shortages: [],
			approximate: false
		});
	});

	it('falls back to the greedy allocation past the budget', () => {
		const jurte = kit('jurte', group([['plane'], ['halbdach', 3]], 6));
		const kohte = kit('kohte', group([['plane'], ['blatt']], 6));
		const result = run([select(jurte), select(kohte)], { plane: 6, halbdach: 2, blatt: 0 }, 0);
		expect(result.approximate).toBe(true);
		expect(result.shortages).toEqual([{ line: 1, groupIndex: 0, missingUnits: 6 }]);
	});
});

describe('pins', () => {
	const roof = group([['halbdach', 3], ['blatt']], 6);

	it('uses only the pinned option', () => {
		const jurte = kit('jurte', roof);
		expect(required([select(jurte, 1, [], ['blatt'])], { halbdach: 2, blatt: 10 })).toEqual({
			blatt: 6
		});
	});

	it('reports a shortage on the pinned option', () => {
		const jurte = kit('jurte', roof);
		const lines = [select(jurte, 1, [], ['blatt'])];
		expect(run(lines, { halbdach: 2, blatt: 4 }).shortages).toEqual([
			{ line: 0, groupIndex: 0, missingUnits: 2 }
		]);
		expect(needs(lines, { halbdach: 2, blatt: 0 })).toMatchObject([
			{ variantId: 'blatt', required: 6, missing: 6 }
		]);
	});

	it('allocates other lines around a pin', () => {
		const jurte = kit('jurte', roof);
		const { assignments } = run([select(jurte), select(jurte, 1, [], ['halbdach'])], {
			halbdach: 2,
			blatt: 6
		});
		expect(assignments.map((a) => [a.line, a.variantId, a.pieces])).toEqual([
			[0, 'blatt', 6],
			[1, 'halbdach', 2]
		]);
	});

	it('ignores unknown pins, pins of single options and of groups packed without', () => {
		const jurte = kit(
			'jurte',
			roof,
			group([['hering']], 10),
			group([['doppel', 2], ['fenster']], ...optional(4))
		);
		const pins = ['geist', 'hering', 'fenster'];
		expect(activePins(select(jurte, 1, [], pins))).toEqual([undefined, undefined, undefined]);
		expect(activePins(select(jurte, 1, [0, 0, 1], pins))[2]).toMatchObject({
			materialId: 'fenster'
		});
		expect(
			required([select(jurte, 1, [], pins)], { halbdach: 2, blatt: 6, hering: 10, doppel: 2 })
		).toEqual({ halbdach: 2, hering: 10 });
	});
});

describe('allocation of the demo kits', () => {
	// The demo kits and stock (October 2026), with "*" for any variant.
	const seile = group(
		[
			['seil 20', 1, 0],
			['seil 10', 1, 0],
			['seil 15', 1, 0]
		],
		3
	);
	const fenster = (units: number) =>
		group([['doppelfenster', 2], ['fenster']], ['ohne', 0], ['mit', units]);
	const seitenwaende = (units: number) => group([['doppelplane', 2], ['viereck']], units);
	const dach = group([['halbdach', 3], ['kohtenplane std'], ['kohtenplane latz']], 6);
	const jurte = kit(
		'jurte',
		group([['hering']], 14),
		group([['teleskop']], 12),
		group([['seil']], 3),
		group([['jurtenstange']], ['Dreibein', 3], ['Einbein', 1]),
		fenster(12),
		seitenwaende(12),
		dach
	);
	const kohte = kit(
		'kohte',
		group([['kohtenplane std'], ['kohtenplane latz']], 4),
		group([['kohtenstange']], 2),
		group([['hering']], 10),
		seile
	);
	const ovaljurte = kit(
		'ovaljurte',
		group([['teleskop']], 14),
		dach,
		group([['hering']], 16),
		group([['theaterplane']], 2),
		seile,
		fenster(14),
		seitenwaende(14),
		group([['jurtenstange']], 2)
	);
	const superjurte = kit(
		'superjurte',
		seitenwaende(16),
		group([['hering']], 18),
		seile,
		group([['jurtenstange']], 1),
		group([['superdach']], 1),
		group([['teleskop']], 16),
		fenster(16)
	);
	const stock = {
		hering: 76,
		teleskop: 39,
		jurtenstange: 12,
		kohtenstange: 12,
		'seil 10': 8,
		'seil 15': 7,
		'seil 20': 5,
		'seil 30': 3,
		'kohtenplane std': 8,
		'kohtenplane latz': 4,
		halbdach: 2,
		doppelfenster: 18,
		fenster: 12,
		doppelplane: 20,
		viereck: 12,
		superdach: 2,
		theaterplane: 4
	};

	const times = (factor: number) =>
		Object.fromEntries(Object.entries(stock).map(([id, pieces]) => [id, pieces * factor]));

	it('allocates a camp with enough stock at once', () => {
		const lines = [
			select(jurte, 3, [0, 0, 0, 0, 1]),
			select(kohte, 6),
			select(ovaljurte, 1, [0, 0, 0, 0, 0, 1]),
			select(superjurte, 1, [0, 0, 0, 0, 0, 0, 1]),
			select(jurte, 1, [0, 0, 0, 1])
		];
		const start = performance.now();
		const result = run(lines, times(3));
		expect(performance.now() - start).toBeLessThan(50);
		expect(result).toMatchObject({ shortages: [], approximate: false });
	});

	it('searches a camp short of a few things exactly', () => {
		const lines = [
			select(jurte, 3, [0, 0, 0, 0, 1]),
			select(jurte, 1, [0, 0, 0, 1]),
			select(kohte, 4),
			select(ovaljurte, 1, [0, 0, 0, 0, 0, 1]),
			select(superjurte, 1, [0, 0, 0, 0, 0, 0, 1]),
			select(kohte, 1),
			select(jurte, 1, [0, 0, 0, 1, 1]),
			select(ovaljurte, 2)
		];
		const result = run(lines, times(3));
		expect(result.approximate).toBe(false);
		expect(result.shortages.length).toBeGreaterThan(0);
	});

	it('searches a large camp exactly and quickly', () => {
		const lines = [
			select(jurte, 3, [0, 0, 0, 0, 1]),
			select(jurte, 1, [0, 0, 0, 1]),
			select(kohte, 4),
			select(ovaljurte, 1, [0, 0, 0, 0, 0, 1]),
			select(superjurte, 1, [0, 0, 0, 0, 0, 0, 1]),
			select(kohte, 1),
			select(jurte, 1, [0, 0, 0, 1, 1], [null, null, null, null, null, null, 'kohtenplane std']),
			select(ovaljurte, 2)
		];
		const start = performance.now();
		const result = run(lines, stock);
		const elapsed = performance.now() - start;
		expect(result.approximate).toBe(false);
		expect(elapsed).toBeLessThan(200);
	});
});

describe('allocate against a brute-force search', () => {
	/** A deterministic pseudo-random generator (mulberry32). */
	function random(seed: number) {
		return () => {
			seed = (seed + 0x6d2b79f5) | 0;
			let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
			t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
			return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
		};
	}

	interface Use {
		variantId: string;
		unitValue: number;
		rank: number;
	}

	/** A group of a line as the allocation sees it: units, and the variants its options (or its pin) accept. */
	interface Demand {
		line: number;
		groupIndex: number;
		units: number;
		uses: Use[];
	}

	const WIDTH = 5; // missing units, waste, units at rank 1, 2 and 3 or worse

	/** The cost of the best allocation of [demands]. */
	function bruteForce(demands: Demand[], stock: Record<string, number>) {
		let best: number[] | undefined;
		const left = { ...stock };
		const cost = new Array<number>(WIDTH).fill(0);
		const visit = (d: number, u: number, covered: number) => {
			if (d === demands.length) {
				if (!best || isLess(cost, best)) best = [...cost];
				return;
			}
			const { units, uses } = demands[d];
			if (u === uses.length) {
				const [missing, waste] = [Math.max(0, units - covered), Math.max(0, covered - units)];
				cost[0] += missing;
				cost[1] += waste;
				visit(d + 1, 0, 0);
				cost[0] -= missing;
				cost[1] -= waste;
				return;
			}
			const { variantId, unitValue, rank } = uses[u];
			for (let p = 0; p <= Math.min(left[variantId], Math.ceil(units / unitValue)); p++) {
				left[variantId] -= p;
				for (let r = 1; r <= rank; r++) cost[1 + r] += p * unitValue;
				visit(d, u + 1, covered + p * unitValue);
				for (let r = 1; r <= rank; r++) cost[1 + r] -= p * unitValue;
				left[variantId] += p;
			}
		};
		visit(0, 0, 0);
		return best!;
	}

	function isLess(a: number[], b: number[]) {
		const i = a.findIndex((value, index) => value !== b[index]);
		return i >= 0 && a[i] < b[i];
	}

	it('finds an allocation as good as the best one', () => {
		const next = random(7);
		const int = (max: number) => Math.floor(next() * (max + 1));
		// Single-variant materials, one with two variants and one without variants.
		const pool = ['a', 'b', 'c', 's', 's x', 's y', 'geist'];
		for (let round = 0; round < 400; round++) {
			const stock: Record<string, number> = {};
			for (const variant of ['a', 'b', 'c', 's x', 's y']) stock[variant] = int(3);
			const kits = Array.from({ length: 1 + int(1) }, (_, k) =>
				kit(
					`k${k}`,
					...Array.from({ length: 1 + int(1) }, () => {
						const options = pool
							.toSorted(() => next() - 0.5)
							// The material "s" appears either once for any variant or with its variants.
							.filter((option, i, all) =>
								option === 's' ? !all.some((o) => o.startsWith('s ')) : true
							)
							.slice(0, 1 + int(1));
						const units = 1 + int(4);
						return group(
							options.map((option) => [option, 1 + int(2), int(3)]),
							...(int(2) === 0 ? optional(units) : [units])
						);
					})
				)
			);
			const lines = Array.from({ length: 1 + int(2) }, () => {
				const k = kits[int(kits.length - 1)];
				const pins = k.groups.map(({ options }) => {
					const option = options[int(options.length - 1)];
					return next() < 0.3
						? (option.variantId ?? option.materialId)
						: next() < 0.1
							? 'geist'
							: null;
				});
				return select(
					k,
					1 + int(1),
					k.groups.map((g) => int(g.amounts.length - 1)),
					pins
				);
			});
			const [stockMap, variants] = stockOf(stock);
			const result = allocate(lines, stockMap, variants);

			const demands: Demand[] = lines.flatMap((selection, line) => {
				const pins = activePins(selection);
				return selection.kit.groups.flatMap((g, groupIndex) => {
					const units = unitsOf(selection, groupIndex) * selection.quantity;
					if (units <= 0) return [];
					const options = pins[groupIndex] ? [pins[groupIndex]] : g.options;
					const priorities = [...new Set(options.map((o) => o.priority))].sort((x, y) => x - y);
					const uses = options.flatMap((o) =>
						(o.variantId ? [o.variantId] : (variants.get(o.materialId) ?? [])).map((variantId) => ({
							variantId,
							unitValue: o.unitValue,
							rank: priorities.indexOf(o.priority)
						}))
					);
					return [{ line, groupIndex, units, uses }];
				});
			});
			const cost = new Array<number>(WIDTH).fill(0);
			for (const { line, groupIndex, units, uses } of demands) {
				let covered = 0;
				let missing = 0;
				for (const a of result.assignments) {
					if (a.line !== line || a.groupIndex !== groupIndex) continue;
					if (a.missing) {
						missing += a.pieces;
						continue;
					}
					const use = uses.find((u) => u.variantId === a.variantId)!;
					covered += a.pieces * use.unitValue;
					for (let r = 1; r <= use.rank; r++) cost[1 + r] += a.pieces * use.unitValue;
				}
				const short = Math.max(0, units - covered);
				cost[0] += short;
				cost[1] += Math.max(0, covered - units);
				const shortage = result.shortages.find(
					(s) => s.line === line && s.groupIndex === groupIndex
				);
				expect(shortage?.missingUnits ?? 0).toBe(short);
				expect(missing > 0).toBe(short > 0);
			}
			// Stock is never overused.
			for (const [variantId, pieces] of Object.entries(stock)) {
				const used = result.assignments
					.filter((a) => a.variantId === variantId && !a.missing)
					.reduce((sum, a) => sum + a.pieces, 0);
				expect(used).toBeLessThanOrEqual(pieces);
			}
			expect(cost, JSON.stringify({ stock, lines })).toEqual(bruteForce(demands, stock));
		}
	});
});
