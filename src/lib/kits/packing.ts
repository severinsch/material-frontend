import type { IndividualItem, Kit, KitGroup, KitGroupOption, Material } from '#lib/api/index.js';
import type { GroupShortage, KitSelection } from './allocate.js';
import { isAvailableItem } from '#lib/loans.js';

// Helpers for the packing list on the kits page: its state in the URL, labels of its lines, where to find materials,
// and readable shortages.

/**
 * A line of the packing list: a kit, its quantity, and the chosen amount per group (an index into the group's
 * `amounts`, one entry per group, 0 is the default). The same kit can be on several lines with different choices.
 */
export interface PackingLine {
	kitId: string;
	quantity: number;
	choices: number[];
}

/** Whether [kit] has a group with several amounts to choose from. */
export function hasChoices(kit: Kit): boolean {
	return kit.groups.some((group) => group.amounts.length > 1);
}

/** A line for [kit] with the default amounts. */
export function newLine(kit: Kit, quantity = 1): PackingLine {
	return { kitId: kit.id, quantity, choices: kit.groups.map(() => 0) };
}

/**
 * Reads the lines from `kit` query parameters of the form `<kit id>*<quantity>` or
 * `<kit id>*<quantity>*<group index>-<amount index>.<group index>-<amount index>…` (the non-default choices), one
 * parameter per line. `*`, `-` and `.` stay unencoded in URLs. Unknown kits, malformed values and choices that don't
 * exist in the kit are ignored.
 */
export function parseSelection(
	params: Pick<URLSearchParams, 'getAll'>,
	kits: Kit[]
): PackingLine[] {
	const lines: PackingLine[] = [];
	for (const value of params.getAll('kit')) {
		const [id, quantity, choices = ''] = value.split('*');
		const kit = kits.find((k) => k.id === id);
		const count = Number(quantity);
		if (!kit || !Number.isInteger(count) || count <= 0) continue;
		const line = newLine(kit, count);
		for (const choice of choices ? choices.split('.') : []) {
			const [groupIndex, amountIndex] = choice
				.split('-')
				.map((part) => (part ? Number(part) : NaN));
			if (Number.isInteger(amountIndex) && kit.groups[groupIndex]?.amounts[amountIndex]) {
				line.choices[groupIndex] = amountIndex;
			}
		}
		lines.push(line);
	}
	return lines;
}

/** The `kit` query parameters for [lines], see [parseSelection]. */
export function serializeSelection(lines: PackingLine[]): string[] {
	return lines.map(({ kitId, quantity, choices }) => {
		const changed = choices.flatMap((choice, groupIndex) =>
			choice > 0 ? [`${groupIndex}-${choice}`] : []
		);
		return [kitId, quantity, changed.join('.')].filter(Boolean).join('*');
	});
}

/**
 * Combines lines with the same kit and choices, summing their quantities, in the order of their first appearance.
 * While editing, identical lines are allowed (merging them while a choice changes would make lines jump); the
 * summary, the allocation and the printed list use the combined lines.
 */
export function combineLines(lines: PackingLine[]): PackingLine[] {
	const combined = new Map<string, PackingLine>();
	for (const line of lines) {
		const key = `${line.kitId}*${line.choices.join('.')}`;
		const existing = combined.get(key);
		if (existing) existing.quantity += line.quantity;
		else combined.set(key, { ...line, choices: [...line.choices] });
	}
	return [...combined.values()];
}

/** Names a kit option, e.g. "Seil 15 m", or "Seil (beliebig)" for any of its variants. */
export type OptionName = (option: Pick<KitGroupOption, 'materialId' | 'variantId'>) => string;

/** The name of [group] for labels: its own name, or that of its preferred option. */
export function groupLabel(group: KitGroup, nameOf: OptionName): string {
	if (group.name) return group.name;
	const [preferred] = group.options.toSorted((a, b) => a.priority - b.priority);
	return preferred ? nameOf(preferred) : 'Teil';
}

/**
 * The label of a line, e.g. "Jurte (Mittelstange: Einbein, Fenster: mit)", naming the chosen amount of every group
 * that has several; just "Jurte" for a kit without choices. [nameOf] names unnamed groups by their preferred option
 * and shouldn't add parentheses.
 */
export function lineLabel(
	{ kit, choices }: Omit<KitSelection, 'quantity'>,
	nameOf: OptionName
): string {
	const chosen = kit.groups.flatMap((group, index) =>
		group.amounts.length > 1
			? [`${groupLabel(group, nameOf)}: ${group.amounts[choices[index] ?? 0]?.label ?? ''}`]
			: []
	);
	return chosen.length > 0 ? `${kit.name} (${chosen.join(', ')})` : kit.name;
}

export interface Place {
	/** Location name, or one of the special headings below. */
	location: string;
	/** Where exactly, e.g. "Regal 3" or "Keller (3), Garage (5)" for materials in several locations. */
	detail: string;
}

export const SEVERAL_LOCATIONS = 'Mehrere Lagerorte';
export const NO_LOCATION = 'Ohne Lagerort';

/**
 * Where to find the variants [variantIds] of [material]. Bulk variants have their own location; individual ones are
 * located by their usable [items] (active and not POOR, and not lent out if [skipLoaned]).
 */
export function placeOf(
	material: Material,
	variantIds: readonly string[],
	items: IndividualItem[],
	skipLoaned: boolean
): Place {
	if (material.trackingType === 'BULK') {
		return placeOfAll(
			material.variants.filter((variant) => variantIds.includes(variant.id)),
			(variant) => [variant.location?.name, variant.locationDetail],
			(located) => located.map((variant) => variant.name).join(', ')
		);
	}
	const usable = items.filter(
		(item) =>
			variantIds.includes(item.variantId) && isAvailableItem(item) && !(skipLoaned && item.onLoan)
	);
	return placeOfAll(
		usable,
		(item) => [item.storageLocation?.name, item.locationDetail],
		(located) => String(located.length)
	);
}

/**
 * Where to find [things], each stored where [where] says (location name and place): their location and places, or
 * if they are spread, every location with what [inLocation] says about the things there, e.g. "Garage (1), Keller
 * (2)".
 */
function placeOfAll<T>(
	things: T[],
	where: (thing: T) => [location: string | undefined, detail: string | null | undefined],
	inLocation: (located: T[]) => string
): Place {
	const byLocation = Map.groupBy(things, (thing) => where(thing)[0] ?? NO_LOCATION);
	if (byLocation.size === 0) return { location: NO_LOCATION, detail: '' };
	if (byLocation.size === 1) {
		const [[location, located]] = byLocation;
		const details = [...new Set(located.map((thing) => where(thing)[1]).filter(Boolean))];
		return { location, detail: details.join(', ') };
	}
	const detail = [...byLocation]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([location, located]) => `${location} (${inLocation(located)})`)
		.join(', ');
	return { location: SEVERAL_LOCATIONS, detail };
}

/** Sorts entries by location name; several locations and no location come last. */
export function byPlace(a: Place, b: Place): number {
	const rank = (place: Place) =>
		place.location === NO_LOCATION ? 2 : place.location === SEVERAL_LOCATIONS ? 1 : 0;
	return rank(a) - rank(b) || a.location.localeCompare(b.location);
}

/**
 * A shortage in words, e.g. "Jurte – Dach: 5 Einheiten fehlen (2× Jurtenhalbdach oder 5× Kohtenblatt)", or
 * "Jurte (Mittelstange: Dreibein): 3× Jurtenstange fehlen" for a group with a single option.
 *
 * @param label the label of the line, see [lineLabel]
 * @param nameOf names the options, e.g. "Seil (beliebig)"
 */
export function describeShortage(
	shortage: GroupShortage,
	kit: Kit,
	label: string,
	nameOf: OptionName
): string {
	const group = kit.groups[shortage.groupIndex];
	const units = shortage.missingUnits;
	const pieces = group.options
		.toSorted((a, b) => a.priority - b.priority)
		.map((option) => `${Math.ceil(units / option.unitValue)}× ${nameOf(option)}`);
	const part = group.name ? `${label} – ${group.name}` : label;
	if (pieces.length === 1) {
		const [only] = group.options;
		return `${part}: ${pieces[0]} ${Math.ceil(units / only.unitValue) === 1 ? 'fehlt' : 'fehlen'}`;
	}
	const missing = units === 1 ? '1 Einheit fehlt' : `${units} Einheiten fehlen`;
	return `${part}: ${missing} (${pieces.join(' oder ')})`;
}
