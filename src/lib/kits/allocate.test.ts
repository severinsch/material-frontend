import { describe, expect, it } from 'vitest';
import type { Kit, KitGroup } from '#lib/api/index.js';
import { allocate, needsOf, type KitSelection } from './allocate.js';

/** A group with the given options; [amounts] are units, or label and units for several amounts. */
function group(
	options: [materialId: string, unitValue?: number][],
	...amounts: (number | [label: string, units: number])[]
): KitGroup {
	return {
		amounts: amounts.map((amount) =>
			typeof amount === 'number'
				? { label: null, requiredUnits: amount }
				: { label: amount[0], requiredUnits: amount[1] }
		),
		options: options.map(([materialId, unitValue = 1], priority) => ({
			materialId,
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

function needs(selections: KitSelection[], stock: Record<string, number>) {
	const map = new Map(Object.entries(stock));
	return needsOf(allocate(selections, map).assignments, map);
}

function required(selections: KitSelection[], stock: Record<string, number>) {
	return Object.fromEntries(
		needs(selections, stock).map((need) => [need.materialId, need.required])
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
		const { assignments } = allocate([select(roof)], new Map([['halbdach', 1]]));
		expect(assignments).toEqual([
			{ line: 0, groupIndex: 0, materialId: 'halbdach', pieces: 1, missing: false },
			{ line: 0, groupIndex: 0, materialId: 'halbdach', pieces: 1, missing: true }
		]);
		expect(needs([select(roof)], { halbdach: 1 })).toEqual([
			{ materialId: 'halbdach', required: 2, available: 1, byLine: [{ line: 0, pieces: 2 }] }
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
		expect(allocate([select(jurte)], new Map()).shortages).toEqual([
			{ line: 0, groupIndex: 0, missingUnits: 30 }
		]);
	});

	it('allocates several lines of the same kit with different choices', () => {
		const jurte = kit('jurte', group([['stange']], ['Einbein', 1], ['Dreibein', 3]));
		const lines = [select(jurte, 2), select(jurte, 1, [1])];
		expect(needs(lines, { stange: 4 })).toEqual([
			{
				materialId: 'stange',
				required: 5,
				available: 4,
				byLine: [
					{ line: 0, pieces: 2 },
					{ line: 1, pieces: 3 }
				]
			}
		]);
		expect(allocate(lines, new Map([['stange', 4]])).shortages).toEqual([
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
		const { shortages } = allocate(
			[select(jurte, 2, [0, 0, 1])],
			new Map([
				['hering', 60],
				['halbdach', 2],
				['kohtenblatt', 1],
				['fenster', 16]
			])
		);
		// 12 roof units needed, 2 halves and 1 sheet fill 7.
		expect(shortages).toEqual([{ line: 0, groupIndex: 1, missingUnits: 5 }]);
	});

	it('reports no shortages when the stock suffices', () => {
		const jurte = kit('jurte', group([['hering']], 30));
		expect(allocate([select(jurte)], new Map([['hering', 30]])).shortages).toEqual([]);
	});
});
