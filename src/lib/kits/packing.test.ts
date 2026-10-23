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
const kits = new Map([[jurte.id, jurte]]);

describe('selection in the URL', () => {
	it('round-trips lines with their non-default choices', () => {
		const lines = [
			{ kitId: 'jurte', quantity: 2, choices: [0, 0, 0, 1], pins: [null, null, null, null] },
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 1, 0], pins: [null, null, null, null] },
			{ kitId: 'jurte', quantity: 3, choices: [0, 0, 0, 0], pins: [null, null, null, null] }
		];
		const params = new URLSearchParams(serializeSelection(lines).map((v) => ['kit', v]));
		expect(params.toString()).toBe('kit=jurte*2*3-1&kit=jurte*1*2-1&kit=jurte*3');
		expect(parseSelection(params, [jurte])).toEqual(lines);
	});

	it('lists several choices of a line', () => {
		const lines = [
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 1, 1], pins: [null, null, null, null] }
		];
		expect(serializeSelection(lines)).toEqual(['jurte*1*2-1.3-1']);
	});

	it('ignores unknown kits, bad quantities and choices that the kit lacks', () => {
		const params = new URLSearchParams(
			'kit=kohte*1&kit=jurte*x&kit=jurte*0&kit=jurte*1*0-1.2-2.9-1.3-1.2.-1.x-1.3-'
		);
		expect(parseSelection(params, [jurte])).toEqual([
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 0, 1], pins: [null, null, null, null] }
		]);
	});

	it('round-trips pins, also without choices', () => {
		const lines = [
			{
				kitId: 'jurte',
				quantity: 1,
				choices: [0, 0, 0, 0],
				pins: [null, 'kohtenblatt', null, null]
			},
			{ kitId: 'jurte', quantity: 2, choices: [0, 0, 1, 0], pins: [null, 'halbdach', null, null] }
		];
		const params = new URLSearchParams(serializeSelection(lines).map((v) => ['kit', v]));
		expect(params.toString()).toBe('kit=jurte*1**1-kohtenblatt&kit=jurte*2*2-1*1-halbdach');
		expect(parseSelection(params, [jurte])).toEqual(lines);
	});

	it('reads option ids that contain dashes', () => {
		const id = '0b9e6f1c-3a1d-4c55-9a43-7c2d0e1f2a3b';
		const kit: Kit = {
			...jurte,
			groups: [
				{
					...jurte.groups[1],
					options: [...jurte.groups[1].options, { materialId: id, unitValue: 1, priority: 2 }]
				}
			]
		};
		const params = new URLSearchParams(`kit=jurte*1**0-${id}`);
		expect(parseSelection(params, [kit])[0].pins).toEqual([id]);
	});

	it('ignores unknown pins and pins of groups without alternatives', () => {
		const params = new URLSearchParams('kit=jurte*1**0-hering.1-geist.x-halbdach.9-halbdach.1');
		expect(parseSelection(params, [jurte])[0].pins).toEqual([null, null, null, null]);
	});

	it('uses the default amounts when no choice is listed', () => {
		const params = new URLSearchParams('kit=jurte*1');
		expect(parseSelection(params, [jurte])).toEqual([
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 0, 0], pins: [null, null, null, null] }
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
			{ kitId: 'jurte', quantity: 2, choices: [0, 0, 0, 0], pins: [null, null, null, null] },
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 1, 0], pins: [null, null, null, null] },
			{ kitId: 'kohte', quantity: 1, choices: [0], pins: [null] },
			{ kitId: 'jurte', quantity: 1, choices: [0, 0, 0, 0], pins: [null, null, null, null] }
		];
		const kohte: Kit = { ...jurte, id: 'kohte', groups: [jurte.groups[0]] };
		expect(combineLines(lines, new Map([...kits, ['kohte', kohte]]))).toEqual([
			{
				kitId: 'jurte',
				kit: jurte,
				quantity: 3,
				choices: [0, 0, 0, 0],
				pins: [null, null, null, null]
			},
			{
				kitId: 'jurte',
				kit: jurte,
				quantity: 1,
				choices: [0, 0, 1, 0],
				pins: [null, null, null, null]
			},
			{ kitId: 'kohte', kit: kohte, quantity: 1, choices: [0], pins: [null] }
		]);
		expect(lines[0].quantity).toBe(2);
	});

	it('combines lines by their active pins', () => {
		const line = (pins: (string | null)[], choices = [0, 0, 0, 0]) => ({
			kitId: 'jurte',
			quantity: 1,
			choices,
			pins
		});
		const combined = combineLines(
			[
				line([null, 'halbdach', null, null]),
				line([null, null, null, null]),
				line([null, 'halbdach', null, null]),
				// The windows are packed without, so their pin doesn't count.
				line([null, null, null, 'fenster']),
				line([null, null, null, 'fenster'], [0, 0, 0, 1])
			],
			kits
		);
		expect(combined.map((l) => [l.quantity, l.pins[1], l.choices[3]])).toEqual([
			[2, 'halbdach', 0],
			[2, null, 0],
			[1, null, 1]
		]);
	});

	it('drops lines of unknown kits', () => {
		expect(combineLines([{ kitId: 'kohte', quantity: 1, choices: [], pins: [] }], kits)).toEqual(
			[]
		);
	});

	it('names pinned groups', () => {
		const windows = {
			...jurte.groups[3],
			name: 'Fenster',
			options: [
				{ materialId: 'doppelfenster', unitValue: 2, priority: 0 },
				...jurte.groups[3].options
			]
		};
		const kit: Kit = { ...jurte, groups: [...jurte.groups.slice(0, 3), windows] };
		const pins = [null, 'halbdach', null, 'fenster'];
		expect(lineLabel({ kit, choices: [0, 0, 0, 1], pins }, nameOf)).toBe(
			'Jurte (Dach: Jurtenhalbdach, Mittelstange: Einbein, Fenster: mit · Fensterplane)'
		);
		// Without windows, their pin doesn't count.
		expect(lineLabel({ kit, choices: [0, 0, 0, 0], pins }, nameOf)).toBe(
			'Jurte (Dach: Jurtenhalbdach, Mittelstange: Einbein, Fenster: ohne)'
		);
	});
});

describe('describeShortage', () => {
	const label = 'Jurte (Mittelstange: Dreibein, Fensterplane: ohne)';

	it('lists the alternatives that could fill the missing units', () => {
		expect(
			describeShortage(
				{ line: 0, groupIndex: 1, missingUnits: 5 },
				{ kit: jurte, choices: [] },
				label,
				nameOf
			)
		).toBe(
			'Jurte (Mittelstange: Dreibein, Fensterplane: ohne) – Dach: 5 Einheiten fehlen (2× Jurtenhalbdach oder 5× Kohtenblatt)'
		);
	});

	it('names the pieces of a single option', () => {
		const shortage = (missingUnits: number) => ({ line: 0, groupIndex: 0, missingUnits });
		const line = { kit: jurte, choices: [] };
		expect(describeShortage(shortage(3), line, 'Kohte', nameOf)).toBe('Kohte: 3× Hering fehlen');
		expect(describeShortage(shortage(1), line, 'Kohte', nameOf)).toBe('Kohte: 1× Hering fehlt');
	});

	it('names only the pinned option', () => {
		const shortage = { line: 0, groupIndex: 1, missingUnits: 5 };
		const line = (pin: string) => ({ kit: jurte, choices: [], pins: [null, pin] });
		expect(describeShortage(shortage, line('halbdach'), 'Jurte', nameOf)).toBe(
			'Jurte – Dach: 2× Jurtenhalbdach fehlen'
		);
		expect(
			describeShortage({ ...shortage, missingUnits: 1 }, line('kohtenblatt'), 'Jurte', nameOf)
		).toBe('Jurte – Dach: 1× Kohtenblatt fehlt');
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
			describeShortage(
				{ line: 0, groupIndex: 0, missingUnits: 2 },
				{ kit: kohte, choices: [] },
				'Kohte',
				optionName
			)
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
