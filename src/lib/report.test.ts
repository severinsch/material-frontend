import { describe, expect, it } from 'vitest';
import type {
	BulkMaterial,
	IndividualItem,
	IndividualMaterial,
	ItemStatus,
	Purchase
} from '#lib/api/index.js';
import { csvText, formatYears, inventoryReport, reportCsv, valueNote } from './report.js';

const counts = { availableCount: 0, damagedCount: 0, loanedCount: 0 };

function bulk(
	id: string,
	name: string,
	category: string | null,
	variants: { id: string; name?: string; available: number; damaged?: number }[],
	archivedAt: string | null = null
): BulkMaterial {
	return {
		trackingType: 'BULK',
		id,
		name,
		category,
		archivedAt,
		...counts,
		variants: variants.map((v) => ({
			id: v.id,
			name: v.name ?? null,
			availableCount: v.available,
			damagedCount: v.damaged ?? 0,
			loanedCount: 0
		}))
	};
}

function individual(
	id: string,
	name: string,
	category: string | null,
	variants: { id: string; name?: string }[]
): IndividualMaterial {
	return {
		trackingType: 'INDIVIDUAL',
		id,
		name,
		category,
		...counts,
		variants: variants.map((v) => ({ id: v.id, name: v.name ?? null, ...counts }))
	};
}

function item(
	id: string,
	variantId: string,
	price: number | null,
	date: string | null,
	status: ItemStatus = 'ACTIVE'
): IndividualItem {
	return {
		id,
		materialId: 'unused',
		variantId,
		identifier: id,
		condition: 'GOOD',
		status,
		purchasePrice: price,
		purchaseDate: date,
		onLoan: false,
		hasHistory: false
	};
}

function purchase(
	variantId: string,
	quantity: number,
	unitPrice: number | null,
	purchaseDate: string | null
): Purchase {
	return {
		id: `${variantId}-${quantity}`,
		materialId: 'unused',
		variantId,
		quantity,
		unitPrice,
		purchaseDate
	};
}

const materials = [
	bulk('hering', 'Hering', 'Zelte', [{ id: 'hering-v', available: 28, damaged: 2 }]),
	bulk('seil', 'Seil', null, [
		{ id: 'seil-10', name: '10 m', available: 4 },
		{ id: 'seil-15', name: '15 m', available: 6 }
	]),
	individual('jurte', 'Jurte', 'Zelte', [{ id: 'jurte-v' }]),
	bulk('alt', 'Alte Plane', 'Zelte', [{ id: 'alt-v', available: 3 }], '2026-01-01T00:00:00Z'),
	individual('kocher', 'Kocher', 'Kochen', [
		{ id: 'kocher-a', name: 'Gas' },
		{ id: 'kocher-b', name: 'Benzin' }
	])
];
const items = [
	item('J1', 'jurte-v', 400, '2019-04-01'),
	item('J2', 'jurte-v', 450.5, '2023-05-01'),
	item('J3', 'jurte-v', null, null),
	item('J4', 'jurte-v', 380, '2015-01-01', 'DECOMMISSIONED'),
	item('J5', 'jurte-v', 380, '2015-01-01', 'LOST'),
	item('K1', 'kocher-a', 30, '2022-01-01', 'IN_REPAIR'),
	item('K2', 'kocher-b', 45, '2024-01-01')
];
const purchases = [
	purchase('hering-v', 50, 0.35, '2024-03-01'),
	purchase('hering-v', 20, null, '2025-03-01'),
	purchase('seil-15', 2, 12, '2021-06-01'),
	purchase('alt-v', 3, 20, '2010-01-01')
];

const report = inventoryReport(materials, items, purchases);
const find = (id: string) =>
	report.categories.flatMap((c) => c.materials).find((material) => material.id === id)!;

describe('inventoryReport', () => {
	it('groups by category, alphabetically with materials without one last, leaving out archived ones', () => {
		expect(report.categories.map((c) => [c.name, c.materials.map((m) => m.name)])).toEqual([
			['Kochen', ['Kocher']],
			['Zelte', ['Hering', 'Jurte']],
			['', ['Seil']]
		]);
	});

	it('counts bulk stock with damaged pieces, with purchase years and prices but no value', () => {
		const hering = find('hering');
		expect(hering.count).toBe(30);
		expect(hering.years).toEqual([2024, 2025]);
		expect(hering.prices).toEqual({ min: 0.35, max: 0.35 });
		expect(hering.value).toBeNull();
		expect([hering.priced, hering.unpriced]).toEqual([0, 0]);
		expect(hering.variants).toEqual([]);
	});

	it('counts items without retired ones and sums their known prices', () => {
		const jurte = find('jurte');
		expect(jurte.count).toBe(3);
		expect(jurte.years).toEqual([2019, 2023]);
		expect(jurte.prices).toEqual({ min: 400, max: 450.5 });
		expect(jurte.value).toBeCloseTo(850.5);
		expect([jurte.priced, jurte.unpriced]).toEqual([2, 1]);
	});

	it('lists the variants of materials with several and combines them', () => {
		const seil = find('seil');
		expect(seil.variants.map((v) => [v.name, v.count])).toEqual([
			['10 m', 4],
			['15 m', 6]
		]);
		expect([seil.count, seil.years]).toEqual([10, [2021]]);
		const kocher = find('kocher');
		expect(kocher.count).toBe(2);
		expect(kocher.prices).toEqual({ min: 30, max: 45 });
		expect(kocher.value).toBe(75);
	});

	it('sums the values of items', () => {
		expect(report.totals.materials).toBe(4);
		expect(report.totals.count).toBe(30 + 10 + 3 + 2);
		expect(report.totals.items).toEqual({ count: 5, priced: 4, value: 925.5 });
		const zelte = report.categories.find((c) => c.name === 'Zelte')!;
		expect(zelte.totals.count).toBe(33);
		expect(zelte.totals.items.value).toBeCloseTo(850.5);
		const seile = report.categories.find((c) => c.name === '')!;
		expect(seile.totals.items.value).toBeNull();
	});

	it('counts items priced 0 as priced', () => {
		const free = inventoryReport(
			[individual('x', 'Geschenkte Jurte', null, [{ id: 'x-v' }])],
			[item('X1', 'x-v', 0, null)],
			[]
		);
		expect(free.totals.items).toEqual({ count: 1, priced: 1, value: 0 });
	});
});

describe('valueNote', () => {
	it('points out items of which only some have a price', () => {
		expect(valueNote(find('jurte'))).toBe('2 von 3 mit Preis');
		expect(valueNote(find('kocher'))).toBe('');
		expect(valueNote(find('hering'))).toBe('');
	});
});

describe('formatYears', () => {
	it('lists a few years and shortens many to a range', () => {
		expect(formatYears([])).toBe('');
		expect(formatYears([2019, 2023])).toBe('2019, 2023');
		expect(formatYears([2015, 2018, 2020, 2024])).toBe('2015–2024');
	});
});

describe('reportCsv', () => {
	it('has a row per material or variant, with decimal commas', () => {
		const lines = reportCsv(report).split('\r\n');
		expect(lines[0]).toBe(
			'\uFEFFKategorie;Material;Variante;Erfassung;Anzahl;Kaufjahre;Stückpreis von (€);Stückpreis bis (€);Kaufwert (€);Gegenstände mit Preis'
		);
		expect(lines).toContain('Zelte;Hering;;Nach Menge;30;2024, 2025;0,35;0,35;;');
		expect(lines).toContain(';Seil;10 m;Nach Menge;4;;;;;');
		expect(lines).toContain('Kochen;Kocher;Gas;Einzeln;1;2022;30,00;30,00;30,00;1');
		expect(lines.at(-1)).toBe('');
	});

	it('keeps names from being run as formulas', () => {
		const names = ['=SUMME(A1)', '+1', '-Plane', '@Zelt', '\tTab', '\rCR'];
		const injected = inventoryReport(
			names.map((name, index) =>
				bulk(`x${index}`, name, index === 0 ? '=Kat' : null, [{ id: `x${index}-v`, available: 1 }])
			),
			[],
			[]
		);
		const csv = reportCsv(injected);
		expect(csv).toContain("'=Kat;'=SUMME(A1);");
		for (const name of ['+1', '-Plane', '@Zelt']) expect(csv).toContain(`;'${name};`);
		expect(csv).toContain(`;'\tTab;`);
		expect(csv).toContain(`;"'\rCR";`);
		expect(csvText('Plane = groß')).toBe('Plane = groß');
	});

	it('quotes fields with separators', () => {
		const quoted = inventoryReport(
			[bulk('x', 'Plane; groß "neu"', null, [{ id: 'x-v', available: 1 }])],
			[],
			[]
		);
		expect(reportCsv(quoted)).toContain(';"Plane; groß ""neu""";');
	});
});
