import { describe, expect, it } from 'vitest';
import type { IndividualItem, Kit, Material } from '#lib/api/index.js';
import {
	combineLines,
	describeShortage,
	lineLabel,
	parseSelection,
	placeOf,
	serializeSelection,
	SEVERAL_LOCATIONS,
	variantsToFind
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
const nameOf = (option: { materialId: string; variantId?: string | null }) =>
	option.variantId ?? names[option.materialId];

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
	const label = 'Jurte (Mittelstange: Dreibein, Fensterplane: ohne)';

	it('lists the alternatives that could fill the missing units', () => {
		expect(
			describeShortage({ line: 0, groupIndex: 1, missingUnits: 5 }, jurte, label, nameOf)
		).toBe(
			'Jurte (Mittelstange: Dreibein, Fensterplane: ohne) – Dach: 5 Einheiten fehlen (2× Jurtenhalbdach oder 5× Kohtenblatt)'
		);
	});

	it('names the pieces of a single option', () => {
		const shortage = (missingUnits: number) => ({ line: 0, groupIndex: 0, missingUnits });
		expect(describeShortage(shortage(3), jurte, 'Kohte', nameOf)).toBe('Kohte: 3× Hering fehlen');
		expect(describeShortage(shortage(1), jurte, 'Kohte', nameOf)).toBe('Kohte: 1× Hering fehlt');
	});

	it('names options for variants', () => {
		const kohte: Kit = {
			id: 'kohte',
			name: 'Kohte',
			groups: [
				{
					name: 'Abspannung',
					amounts: [{ label: null, requiredUnits: 4 }],
					options: [
						{ materialId: 'seil', variantId: null, unitValue: 1, priority: 0 },
						{ materialId: 'band', variantId: 'Band 5 m', unitValue: 1, priority: 1 }
					]
				}
			]
		};
		const optionName = (option: { materialId: string; variantId?: string | null }) =>
			option.variantId ?? 'Seil (beliebig)';
		expect(
			describeShortage({ line: 0, groupIndex: 0, missingUnits: 2 }, kohte, 'Kohte', optionName)
		).toBe('Kohte – Abspannung: 2 Einheiten fehlen (2× Seil (beliebig) oder 2× Band 5 m)');
	});
});

describe('placeOf', () => {
	const material = { id: 'fenster', trackingType: 'INDIVIDUAL' } as Material;
	const item = (location: string | null, detail: string | null = null, extra = {}) =>
		({
			materialId: 'fenster',
			variantId: 'fenster-1',
			status: 'ACTIVE',
			condition: 'GOOD',
			onLoan: false,
			storageLocation: location ? { id: location, name: location } : null,
			locationDetail: detail,
			...extra
		}) as IndividualItem;

	it('uses the location of the usable items', () => {
		const items = [item('Keller', 'Regal 1'), item('Garage', null, { status: 'LOST' })];
		expect(placeOf(material, ['fenster-1'], items, true)).toEqual({
			location: 'Keller',
			detail: 'Regal 1'
		});
	});

	it('counts items per location when they are spread', () => {
		const items = [
			item('Keller'),
			item('Garage'),
			item('Keller'),
			item('Garage', null, { onLoan: true })
		];
		expect(placeOf(material, ['fenster-1'], items, true)).toEqual({
			location: SEVERAL_LOCATIONS,
			detail: 'Garage (1), Keller (2)'
		});
	});

	it('only counts items of the given variants', () => {
		const items = [item('Keller'), item('Garage', null, { variantId: 'fenster-2' })];
		expect(placeOf(material, ['fenster-1'], items, true).location).toBe('Keller');
	});

	it('uses the locations of bulk variants', () => {
		const location = (name: string | null) => (name ? { id: name, name } : null);
		const variant = (id: string, name: string, at: string | null, detail: string | null) => ({
			id,
			name,
			availableCount: 1,
			damagedCount: 0,
			loanedCount: 0,
			location: location(at),
			locationDetail: detail
		});
		const seil = {
			id: 'seil',
			trackingType: 'BULK',
			variants: [
				variant('10', '10 m', 'Keller', 'Kiste 1'),
				variant('15', '15 m', 'Keller', 'Kiste 2'),
				variant('20', '20 m', 'Garage', null)
			]
		} as Material;
		expect(placeOf(seil, ['10', '15'], [], true)).toEqual({
			location: 'Keller',
			detail: 'Kiste 1, Kiste 2'
		});
		expect(placeOf(seil, ['10', '15', '20'], [], true)).toEqual({
			location: SEVERAL_LOCATIONS,
			detail: 'Garage (20 m), Keller (10 m, 15 m)'
		});
	});
});

describe('variantsToFind', () => {
	const variantIds = new Map([['seil', ['10', '15', '20']]]);
	const need = (variantId: string | null, ...from: string[]) => ({
		materialId: 'seil',
		variantId,
		variantIds: from
	});

	it('looks where the pieces are taken from', () => {
		expect(variantsToFind(need('15', '15'), variantIds)).toEqual(['15']);
		expect(variantsToFind(need(null, '10', '20'), variantIds)).toEqual(['10', '20']);
	});

	it('looks for the variant itself, or any of the material, if all pieces are missing', () => {
		expect(variantsToFind(need('20'), variantIds)).toEqual(['20']);
		expect(variantsToFind(need(null), variantIds)).toEqual(['10', '15', '20']);
	});
});
