import { describe, expect, it } from 'vitest';
import type { IndividualItem, Kit, Material } from '#lib/api/index.js';
import {
	combineLines,
	describeShortage,
	lineLabel,
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
			amounts: [{ label: null, requiredUnits: 30 }],
			options: [{ materialId: 'hering', unitValue: 1, priority: 0 }]
		},
		{
			name: 'Dach',
			amounts: [{ label: null, requiredUnits: 6 }],
			options: [
				{ materialId: 'kohtenblatt', unitValue: 1, priority: 1 },
				{ materialId: 'halbdach', unitValue: 3, priority: 0 }
			]
		},
		{
			name: 'Mittelstange',
			amounts: [
				{ label: 'Einbein', requiredUnits: 1 },
				{ label: 'Dreibein', requiredUnits: 3 }
			],
			options: [{ materialId: 'stange', unitValue: 1, priority: 0 }]
		},
		{
			amounts: [
				{ label: 'ohne', requiredUnits: 0 },
				{ label: 'mit', requiredUnits: 8 }
			],
			options: [{ materialId: 'fenster', unitValue: 1, priority: 0 }]
		}
	]
};

const names: Record<string, string> = {
	hering: 'Hering',
	halbdach: 'Jurtenhalbdach',
	kohtenblatt: 'Kohtenblatt',
	stange: 'Jurtenstange',
	fenster: 'Fensterplane'
};
const nameOf = (id: string) => names[id];

describe('selection in the URL', () => {
	it('round-trips lines with their non-default choices', () => {
		const lines = [
			{ kitId: 'jurte', quantity: 2, choices: [0, 0, 0, 1] },
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 1, 0] },
			{ kitId: 'jurte', quantity: 3, choices: [0, 0, 0, 0] }
		];
		const params = new URLSearchParams(serializeSelection(lines).map((v) => ['kit', v]));
		expect(params.toString()).toBe('kit=jurte*2*3-1&kit=jurte*1*2-1&kit=jurte*3');
		expect(parseSelection(params, [jurte])).toEqual(lines);
	});

	it('lists several choices of a line', () => {
		const lines = [{ kitId: 'jurte', quantity: 1, choices: [0, 0, 1, 1] }];
		expect(serializeSelection(lines)).toEqual(['jurte*1*2-1.3-1']);
	});

	it('ignores unknown kits, bad quantities and choices that the kit lacks', () => {
		const params = new URLSearchParams(
			'kit=kohte*1&kit=jurte*x&kit=jurte*0&kit=jurte*1*0-1.2-2.9-1.3-1.2.-1.x-1.3-'
		);
		expect(parseSelection(params, [jurte])).toEqual([
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 0, 1] }
		]);
	});

	it('uses the default amounts when no choice is listed', () => {
		const params = new URLSearchParams('kit=jurte*1');
		expect(parseSelection(params, [jurte])).toEqual([
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 0, 0] }
		]);
	});
});

describe('lines', () => {
	it('names the chosen amount of groups with several', () => {
		expect(lineLabel({ kit: jurte, choices: [0, 0, 1, 1] }, nameOf)).toBe(
			'Jurte (Mittelstange: Dreibein, Fensterplane: mit)'
		);
		const kohte: Kit = { ...jurte, name: 'Kohte', groups: jurte.groups.slice(0, 2) };
		expect(lineLabel({ kit: kohte, choices: [0, 0] }, nameOf)).toBe('Kohte');
	});

	it('combines identical lines in the order of their first appearance', () => {
		const lines = [
			{ kitId: 'jurte', quantity: 2, choices: [0, 0, 0, 0] },
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 1, 0] },
			{ kitId: 'kohte', quantity: 1, choices: [0] },
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 0, 0] }
		];
		expect(combineLines(lines)).toEqual([
			{ kitId: 'jurte', quantity: 3, choices: [0, 0, 0, 0] },
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 1, 0] },
			{ kitId: 'kohte', quantity: 1, choices: [0] }
		]);
		expect(lines[0].quantity).toBe(2);
	});
});

describe('describeShortage', () => {
	const line = { kit: jurte, choices: [0, 0, 1, 0] };

	it('lists the alternatives that could fill the missing units', () => {
		expect(describeShortage({ line: 0, groupIndex: 1, missingUnits: 5 }, line, nameOf)).toBe(
			'Jurte (Mittelstange: Dreibein, Fensterplane: ohne) – Dach: 5 Einheiten fehlen (2× Jurtenhalbdach oder 5× Kohtenblatt)'
		);
	});

	it('names the pieces of a single material', () => {
		const kohte: Kit = { ...jurte, name: 'Kohte', groups: jurte.groups.slice(0, 1) };
		expect(
			describeShortage(
				{ line: 0, groupIndex: 0, missingUnits: 3 },
				{ kit: kohte, choices: [0] },
				nameOf
			)
		).toBe('Kohte: 3× Hering fehlen');
		expect(
			describeShortage(
				{ line: 0, groupIndex: 0, missingUnits: 1 },
				{ kit: kohte, choices: [0] },
				nameOf
			)
		).toBe('Kohte: 1× Hering fehlt');
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
