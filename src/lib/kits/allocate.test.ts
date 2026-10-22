import { describe, expect, it } from 'vitest';
import type { Kit, KitGroup } from '#lib/api/index.js';
import { allocate, needsOf, type KitSelection } from './allocate.js';

// Variant ids are the material id, followed by the variant's name for materials with several ("seil 20"). An option
// "seil" accepts any variant of the material, "seil 20" only that one.

const materialOf = (variantId: string) => variantId.split(' ')[0];

/** A group with the given options; [amounts] are units, or label and units for several amounts. */
function group(
	options: [option: string, unitValue?: number][],
	...amounts: (number | [label: string, units: number])[]
): KitGroup {
	return {
		amounts: amounts.map((amount) =>
			typeof amount === 'number'
				? { label: null, requiredUnits: amount }
				: { label: amount[0], requiredUnits: amount[1] }
		),
		options: options.map(([option, unitValue = 1], priority) => ({
			materialId: materialOf(option),
			variantId: option.includes(' ') ? option : null,
			unitValue,
			priority
		}))
	};
}

function kit(id: string, ...groups: KitGroup[]): Kit {
	return { id, name: id, groups };
}

function select(kit: Kit, quantity = 1, choices: number[] = []): KitSelection {
	return { kit, quantity, choices };
}

/** The stock by variant id, and the variants of each material, which are the variants in [stock]. */
function stockOf(stock: Record<string, number>) {
	const variants = Map.groupBy(Object.keys(stock), materialOf);
	return [new Map(Object.entries(stock)), variants] as const;
}

function run(selections: KitSelection[], stock: Record<string, number>) {
	return allocate(selections, ...stockOf(stock));
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
