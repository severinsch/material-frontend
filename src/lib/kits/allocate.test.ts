import { describe, expect, it } from 'vitest';
import type { Kit, KitGroup } from '#lib/api/index.js';
import { allocate, type KitSelection } from './allocate.js';

function group(
	options: [materialId: string, unitValue?: number][],
	requiredUnits: number,
	isOptional = false
): KitGroup {
	return {
		requiredUnits,
		isOptional,
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

function select(kit: Kit, quantity = 1, includedGroups: number[] = []): KitSelection {
	return { kit, quantity, includedGroups: new Set(includedGroups) };
}

function required(selections: KitSelection[], stock: Record<string, number>) {
	return Object.fromEntries(
		allocate(selections, new Map(Object.entries(stock))).map((need) => [
			need.materialId,
			need.required
		])
	);
}

describe('allocate', () => {
	it('multiplies groups with the kit quantity', () => {
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

	it('counts missing pieces on the preferred option', () => {
		const roof = kit('jurte', group([['halbdach', 3], ['kohtenblatt']], 6));
		const [need] = allocate([select(roof)], new Map([['halbdach', 1]]));
		expect(need).toEqual({
			materialId: 'halbdach',
			required: 2,
			available: 1,
			byKit: [{ kitId: 'jurte', quantity: 2 }]
		});
	});

	it('packs optional groups only when included', () => {
		const jurte = kit('jurte', group([['hering']], 30), group([['fenster']], 8, true));
		expect(required([select(jurte)], { hering: 30, fenster: 8 })).toEqual({ hering: 30 });
		expect(required([select(jurte, 1, [1])], { hering: 30, fenster: 8 })).toEqual({
			hering: 30,
			fenster: 8
		});
	});

	it('serves groups without alternatives first', () => {
		const flexible = kit('flexible', group([['kohtenblatt'], ['plane']], 4));
		const fixed = kit('fixed', group([['kohtenblatt']], 4));
		expect(required([select(flexible), select(fixed)], { kohtenblatt: 4, plane: 4 })).toEqual({
			kohtenblatt: 4,
			plane: 4
		});
	});

	it('breaks needs down by kit', () => {
		const a = kit('a', group([['hering']], 10));
		const b = kit('b', group([['hering']], 20));
		const [need] = allocate([select(a), select(b)], new Map([['hering', 100]]));
		expect(need.byKit).toEqual([
			{ kitId: 'a', quantity: 10 },
			{ kitId: 'b', quantity: 20 }
		]);
	});
});
