// The inventory report (Inventarliste) for the Vorstand, the yearly cash audit or insurance: what the Stamm owns per
// category, with purchase years and prices where they were recorded. Values are purchase prices, without depreciation.
//
// Only individual items have a value: they carry their own purchase price. Bulk stock isn't tied to purchases (50
// Heringe bought in 2024 may be 30 today), so bulk lines show the years and prices of their purchases, but no value.

import type { IndividualItem, Material, Purchase } from '#lib/api/index.js';
import { isRetired } from '#lib/items.js';

/** A material, or one of its variants, in the report. */
export interface ReportLine {
	key: string;
	/** The material's name, or the variant's name on variant lines. */
	name: string;
	trackingType: Material['trackingType'];
	/** Pieces owned: bulk stock including damaged and lent pieces, or items that aren't decommissioned or lost. */
	count: number;
	/** The distinct years of purchase, ascending. */
	years: number[];
	/** The lowest and highest known unit price, or null if none is known. */
	prices: { min: number; max: number } | null;
	/** The sum of the items' known prices; null for bulk stock and for items without any known price. */
	value: number | null;
	/** Items with a known price; 0 for bulk stock. */
	priced: number;
	/** Items without a price; 0 for bulk stock. */
	unpriced: number;
}

export interface ReportMaterial extends ReportLine {
	id: string;
	/** The lines of the variants, if the material has several. */
	variants: ReportLine[];
}

/** Sums over materials. */
export interface ReportTotals {
	materials: number;
	/** Pieces owned, see [ReportLine.count]. */
	count: number;
	/** Items owned, how many of them have a price, and the sum of those prices (null if none has one). */
	items: { count: number; priced: number; value: number | null };
}

export interface ReportCategory {
	/** The category, or '' for materials without one. */
	name: string;
	materials: ReportMaterial[];
	totals: ReportTotals;
}

export interface InventoryReport {
	categories: ReportCategory[];
	totals: ReportTotals;
}

/** [value] in euros rounded to cents, against floating point remainders in sums like 50 × 0.35. */
const cents = (value: number) => Math.round(value * 100) / 100;

/** The year of a date like `2024-05-01`. */
const yearOf = (date: string) => Number(date.slice(0, 4));

function line(
	key: string,
	name: string,
	trackingType: Material['trackingType'],
	count: number,
	/** Purchases of bulk stock, or the items (one each). */
	bought: { price: number | null | undefined; date: string | null | undefined }[]
): ReportLine {
	const prices = bought.flatMap((entry) => (entry.price == null ? [] : [entry.price]));
	const years = new Set(bought.flatMap((entry) => (entry.date ? [yearOf(entry.date)] : [])));
	const items = trackingType === 'INDIVIDUAL';
	return {
		key,
		name,
		trackingType,
		count,
		years: [...years].sort((a, b) => a - b),
		prices: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
		value:
			items && prices.length > 0 ? cents(prices.reduce((total, price) => total + price, 0)) : null,
		priced: items ? prices.length : 0,
		unpriced: items ? bought.length - prices.length : 0
	};
}

/** Combines the lines of a material's variants into the material's line. */
function combine(
	key: string,
	name: string,
	trackingType: Material['trackingType'],
	lines: ReportLine[]
): ReportLine {
	const prices = lines.flatMap((l) => (l.prices ? [l.prices.min, l.prices.max] : []));
	const sum = (value: (l: ReportLine) => number) => lines.reduce((total, l) => total + value(l), 0);
	const valued = lines.filter((l) => l.value != null);
	return {
		key,
		name,
		trackingType,
		count: sum((l) => l.count),
		years: [...new Set(lines.flatMap((l) => l.years))].sort((a, b) => a - b),
		prices: prices.length > 0 ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
		value: valued.length > 0 ? cents(valued.reduce((total, l) => total + l.value!, 0)) : null,
		priced: sum((l) => l.priced),
		unpriced: sum((l) => l.unpriced)
	};
}

function totalsOf(materials: ReportMaterial[]): ReportTotals {
	const totals: ReportTotals = {
		materials: materials.length,
		count: 0,
		items: { count: 0, priced: 0, value: null }
	};
	for (const material of materials) {
		totals.count += material.count;
		if (material.trackingType !== 'INDIVIDUAL') continue;
		totals.items.count += material.count;
		totals.items.priced += material.priced;
		if (material.value != null)
			totals.items.value = cents((totals.items.value ?? 0) + material.value);
	}
	return totals;
}

/** Categories in alphabetical order, materials without one last (as in the material list). */
function categoryOrder(a: string, b: string) {
	return (a === '') !== (b === '') ? (a === '' ? 1 : -1) : a.localeCompare(b);
}

/**
 * The report of the tenant's [materials], leaving out archived materials and retired items (decommissioned or lost).
 * [items] and [purchases] are those of all materials.
 */
export function inventoryReport(
	materials: readonly Material[],
	items: readonly IndividualItem[],
	purchases: readonly Purchase[]
): InventoryReport {
	const itemsByVariant = Map.groupBy(
		items.filter((item) => !isRetired(item)),
		(item) => item.variantId
	);
	const purchasesByVariant = Map.groupBy(purchases, (purchase) => purchase.variantId);

	function reportOf(material: Material): ReportMaterial {
		const lines = material.variants.map((variant) => {
			const key = `${material.id}/${variant.id}`;
			const name = variant.name ?? material.name;
			if (material.trackingType === 'BULK') {
				const bought = (purchasesByVariant.get(variant.id) ?? []).map((purchase) => ({
					price: purchase.unitPrice,
					date: purchase.purchaseDate
				}));
				return line(key, name, 'BULK', variant.availableCount + variant.damagedCount, bought);
			}
			const owned = itemsByVariant.get(variant.id) ?? [];
			const bought = owned.map((item) => ({
				price: item.purchasePrice,
				date: item.purchaseDate
			}));
			return line(key, name, 'INDIVIDUAL', owned.length, bought);
		});
		return {
			...combine(material.id, material.name, material.trackingType, lines),
			id: material.id,
			variants: lines.length > 1 ? lines : []
		};
	}

	const active = materials.filter((material) => !material.archivedAt);
	const categories = [...Map.groupBy(active, (material) => material.category ?? '')]
		.toSorted(([a], [b]) => categoryOrder(a, b))
		.map(([name, inCategory]) => {
			const sorted = inCategory
				.map(reportOf)
				.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
			return { name, materials: sorted, totals: totalsOf(sorted) };
		});
	return { categories, totals: totalsOf(categories.flatMap((category) => category.materials)) };
}

/** Purchase years for display: "2019, 2023", a range for many, e.g. "2015–2024", or "" if unknown. */
export function formatYears(years: readonly number[]): string {
	return years.length > 3 ? `${years[0]}–${years[years.length - 1]}` : years.join(', ');
}

/** A number for German spreadsheets: decimal comma, no thousands separator, e.g. "1234,50". */
function csvNumber(value: number, decimals = 2): string {
	return value.toFixed(decimals).replace('.', ',');
}

/**
 * A text cell that spreadsheets don't run as a formula: names starting with "=", "+", "-", "@", a tab or a carriage
 * return get a leading apostrophe (CSV injection).
 */
export function csvText(text: string): string {
	return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvField(value: string | number): string {
	const text = String(value);
	return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/**
 * The report as CSV for spreadsheets (semicolon-separated with decimal commas, as German Excel expects): one row per
 * material, or per variant for materials with several.
 */
export function reportCsv(report: InventoryReport): string {
	const header = [
		'Kategorie',
		'Material',
		'Variante',
		'Erfassung',
		'Anzahl',
		'Kaufjahre',
		'Stückpreis von (€)',
		'Stückpreis bis (€)',
		'Kaufwert (€)',
		'Gegenstände mit Preis'
	];
	const rows = report.categories.flatMap((category) =>
		category.materials.flatMap((material) =>
			(material.variants.length > 0 ? material.variants : [material]).map((l) => [
				csvText(category.name),
				csvText(material.name),
				material.variants.length > 0 ? csvText(l.name) : '',
				l.trackingType === 'BULK' ? 'Nach Menge' : 'Einzeln',
				l.count,
				l.years.join(', '),
				l.prices ? csvNumber(l.prices.min) : '',
				l.prices ? csvNumber(l.prices.max) : '',
				l.value != null ? csvNumber(l.value) : '',
				l.trackingType === 'INDIVIDUAL' ? l.priced : ''
			])
		)
	);
	// The byte order mark makes Excel read the file as UTF-8 (umlauts).
	return (
		'\uFEFF' + [header, ...rows].map((row) => row.map(csvField).join(';')).join('\r\n') + '\r\n'
	);
}

/** For items of which only some have a price, e.g. "2 von 3 mit Preis"; otherwise ''. */
export function valueNote(line: ReportLine): string {
	return line.priced > 0 && line.unpriced > 0
		? `${line.priced} von ${line.priced + line.unpriced} mit Preis`
		: '';
}
