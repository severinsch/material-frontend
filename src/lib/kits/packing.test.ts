import { describe, expect, it } from 'vitest';
import type { IndividualItem, Kit, Material } from '#lib/api/index.js';
import {
	describeShortage,
	parseSelection,
	placeOf,
	serializeSelection,
	SEVERAL_LOCATIONS
} from './packing.js';

const jurte: Kit = {
	id: 'jurte',
	name: 'Jurte',
	groups: [
		{
			requiredUnits: 30,
			isOptional: false,
			options: [{ materialId: 'hering', unitValue: 1, priority: 0 }]
		},
		{
			name: 'Dach',
			requiredUnits: 6,
			isOptional: false,
			options: [
				{ materialId: 'kohtenblatt', unitValue: 1, priority: 1 },
				{ materialId: 'halbdach', unitValue: 3, priority: 0 }
			]
		},
		{
			requiredUnits: 8,
			isOptional: true,
			options: [{ materialId: 'fenster', unitValue: 1, priority: 0 }]
		}
	]
};

describe('selection in the URL', () => {
	it('round-trips quantities and included optional groups', () => {
		const selection = new Map([['jurte', { quantity: 2, includedGroups: new Set([2]) }]]);
		const params = new URLSearchParams(serializeSelection(selection).map((v) => ['kit', v]));
		expect(params.toString()).toBe('kit=jurte*2*2');
		expect(parseSelection(params, [jurte])).toEqual(selection);
	});

	it('ignores unknown kits, bad quantities and non-optional groups', () => {
		const params = new URLSearchParams('kit=kohte*1&kit=jurte*x&kit=jurte*1*0.1.2.9');
		expect(parseSelection(params, [jurte])).toEqual(
			new Map([['jurte', { quantity: 1, includedGroups: new Set([2]) }]])
		);
	});

	it('includes no optional group when none is listed', () => {
		const optionalFirst: Kit = { ...jurte, groups: jurte.groups.toReversed() };
		const params = new URLSearchParams('kit=jurte*1');
		expect(parseSelection(params, [optionalFirst])).toEqual(
			new Map([['jurte', { quantity: 1, includedGroups: new Set() }]])
		);
	});
});

describe('describeShortage', () => {
	const names: Record<string, string> = {
		hering: 'Hering',
		halbdach: 'Jurtenhalbdach',
		kohtenblatt: 'Kohtenblatt'
	};
	const nameOf = (id: string) => names[id];

	it('lists the alternatives that could fill the missing units', () => {
		expect(
			describeShortage({ kitId: 'jurte', groupIndex: 1, missingUnits: 5 }, jurte, nameOf)
		).toBe('Jurte – Dach: 5 Einheiten fehlen (2× Jurtenhalbdach oder 5× Kohtenblatt)');
	});

	it('names the pieces of a single material', () => {
		expect(
			describeShortage({ kitId: 'jurte', groupIndex: 0, missingUnits: 3 }, jurte, nameOf)
		).toBe('Jurte: 3× Hering fehlen');
		expect(
			describeShortage({ kitId: 'jurte', groupIndex: 0, missingUnits: 1 }, jurte, nameOf)
		).toBe('Jurte: 1× Hering fehlt');
	});
});

describe('placeOf', () => {
	const material = { id: 'fenster', trackingType: 'INDIVIDUAL' } as Material;
	const item = (location: string | null, detail: string | null = null, extra = {}) =>
		({
			materialId: 'fenster',
			status: 'ACTIVE',
			condition: 'GOOD',
			onLoan: false,
			storageLocation: location ? { id: location, name: location } : null,
			locationDetail: detail,
			...extra
		}) as IndividualItem;

	it('uses the location of the usable items', () => {
		const items = [item('Keller', 'Regal 1'), item('Garage', null, { status: 'LOST' })];
		expect(placeOf(material, items, true)).toEqual({ location: 'Keller', detail: 'Regal 1' });
	});

	it('counts items per location when they are spread', () => {
		const items = [
			item('Keller'),
			item('Garage'),
			item('Keller'),
			item('Garage', null, { onLoan: true })
		];
		expect(placeOf(material, items, true)).toEqual({
			location: SEVERAL_LOCATIONS,
			detail: 'Garage (1), Keller (2)'
		});
	});
});
