import type { IndividualItem, Kit, KitGroup, KitGroupOption, Material } from '#lib/api/index.js';
import {
	activePins,
	isPinnable,
	optionId,
	sortedOptions,
	type GroupShortage,
	type KitSelection,
	type MaterialNeed
} from './allocate.js';
import { formatKg } from '#lib/format.js';
import { isAvailableItem } from '#lib/loans.js';

// Helpers for the packing list on the kits page: its state in the URL, labels of its lines, where to find materials,
// and readable shortages.

/**
 * A line of the packing list: a kit, its quantity, the chosen amount per group (an index into the group's `amounts`,
 * one entry per group, 0 is the default) and the option each group is pinned to (its `optionId`, null for
 * automatic). The same kit can be on several lines with different choices and pins.
 *
 * For tents, [notSleeping] of them aren't for sleeping (a Jurte as kitchen); it doesn't change what is packed. It
 * counts the tents that aren't, so that adding tents to the line counts them as sleeping tents without syncing.
 */
export interface PackingLine {
	kitId: string;
	quantity: number;
	choices: number[];
	pins: (string | null)[];
	notSleeping: number;
}

/** Whether [kit] has a group with several amounts to choose from. */
export function hasChoices(kit: Kit): boolean {
	return kit.groups.some((group) => group.amounts.length > 1);
}

/** Whether [kit] has a group with several options, which a line can pin. */
export function hasAlternatives(kit: Kit): boolean {
	return kit.groups.some((group) => group.options.length > 1);
}

/** A line for [kit] with the default amounts and no pins. */
export function newLine(kit: Kit, quantity = 1): PackingLine {
	return {
		kitId: kit.id,
		quantity,
		choices: kit.groups.map(() => 0),
		pins: kit.groups.map(() => null),
		notSleeping: 0
	};
}

/**
 * Reads the lines from `kit` query parameters, one per line, of the form `<kit id>*<quantity>`, followed by the
 * non-default choices `*<group index>-<amount index>.<group index>-<amount index>…` and the pins
 * `*<group index>-<option id>.…` if there are any (`<kit id>*2**6-<option id>` for pins without choices), and the
 * number of tents not for sleeping `*<count>` if there are any (`<kit id>*3***1`). `*`, `-` and `.` stay unencoded in
 * URLs. Unknown kits, malformed values, and choices or pins that don't exist in the kit are ignored, and so are pins of
 * groups that can't be pinned (see `isPinnable`). The number of tents not for sleeping is capped at the quantity.
 */
export function parseSelection(
	params: Pick<URLSearchParams, 'getAll'>,
	kits: Kit[]
): PackingLine[] {
	const lines: PackingLine[] = [];
	for (const value of params.getAll('kit')) {
		const [id, quantity, choices = '', pins = '', notSleeping = ''] = value.split('*');
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
		for (const pin of pins ? pins.split('.') : []) {
			// Option ids are UUIDs, which contain "-" themselves.
			const separator = pin.indexOf('-');
			const groupIndex = separator > 0 ? Number(pin.slice(0, separator)) : NaN;
			const id = pin.slice(separator + 1);
			const group = Number.isInteger(groupIndex) ? kit.groups[groupIndex] : undefined;
			if (
				group &&
				isPinnable({ kit, choices: line.choices }, groupIndex) &&
				group.options.some((o) => optionId(o) === id)
			) {
				line.pins[groupIndex] = id;
			}
		}
		const notSleepingCount = Number(notSleeping);
		if (Number.isInteger(notSleepingCount) && notSleepingCount > 0) {
			line.notSleeping = Math.min(notSleepingCount, count);
		}
		lines.push(line);
	}
	return lines;
}

/** The `kit` query parameters for [lines], see [parseSelection]. */
export function serializeSelection(lines: PackingLine[]): string[] {
	return lines.map(({ kitId, quantity, choices, pins, notSleeping }) => {
		const changed = choices.flatMap((choice, groupIndex) =>
			choice > 0 ? [`${groupIndex}-${choice}`] : []
		);
		const pinned = pins.flatMap((pin, groupIndex) => (pin ? [`${groupIndex}-${pin}`] : []));
		const segments = [
			kitId,
			String(quantity),
			changed.join('.'),
			pinned.join('.'),
			notSleeping > 0 ? String(notSleeping) : ''
		];
		// Built explicitly: empty segments must stay when others follow.
		while (segments.at(-1) === '') segments.pop();
		return segments.join('*');
	});
}

/** A packing line with its kit. */
export type KitLine = PackingLine & { kit: Kit };

/**
 * Combines lines with the same kit, choices and active pins (see `activePins`), summing their quantities, in the
 * order of their first appearance, and adds their kits; lines of unknown kits are dropped. The tents not for sleeping
 * don't make lines different, since they don't change what is packed; they are summed too. While editing, identical
 * lines are allowed (merging them while a choice changes would make lines jump); the summary, the allocation and the
 * printed list use the combined lines.
 */
export function combineLines(lines: PackingLine[], kits: ReadonlyMap<string, Kit>): KitLine[] {
	const combined = new Map<string, KitLine>();
	for (const line of lines) {
		const kit = kits.get(line.kitId);
		if (!kit) continue;
		const pins = activePins({ kit, ...line }).map((option) => (option ? optionId(option) : ''));
		const key = `${line.kitId}*${line.choices.join('.')}*${pins.join('.')}`;
		const existing = combined.get(key);
		if (existing) {
			existing.quantity += line.quantity;
			existing.notSleeping += line.notSleeping;
		} else combined.set(key, { ...line, kit, choices: [...line.choices], pins: [...line.pins] });
	}
	return [...combined.values()];
}

/** Names a kit option, e.g. "Seil 15 m", or "Seil (beliebig)" for any of its variants. */
export type OptionName = (option: Pick<KitGroupOption, 'materialId' | 'variantId'>) => string;

/** The name of [group] for labels: its own name, or that of its preferred option. */
export function groupLabel(group: KitGroup, nameOf: OptionName): string {
	if (group.name) return group.name;
	const [preferred] = sortedOptions(group);
	return preferred ? nameOf(preferred) : 'Teil';
}

/**
 * The label of a line, e.g. "Jurte (Mittelstange: Einbein, Dach: Jurtenhalbdach)", naming the chosen amount of every
 * group that has several and the option of every pinned group (both: "Fenster: mit · Fensterplane"); just "Jurte"
 * for a kit without choices and pins. [nameOf] names the options and unnamed groups (by their preferred option) and
 * shouldn't add parentheses.
 */
export function lineLabel(selection: Omit<KitSelection, 'quantity'>, nameOf: OptionName): string {
	const { kit, choices } = selection;
	const pins = activePins(selection);
	const chosen = kit.groups.flatMap((group, index) => {
		const parts = [
			group.amounts.length > 1 ? (group.amounts[choices[index] ?? 0]?.label ?? '') : undefined,
			pins[index] && nameOf(pins[index])
		].filter((part) => part !== undefined);
		return parts.length > 0 ? [`${groupLabel(group, nameOf)}: ${parts.join(' · ')}`] : [];
	});
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
 * The variants to look for the pieces of [need]: the ones they are taken from. If all of them are missing, those of
 * its variant, or of any of its material's [variantIds] (by material id), are welcome.
 */
export function variantsToFind(
	need: Pick<MaterialNeed, 'materialId' | 'variantId' | 'variantIds'>,
	variantIds: ReadonlyMap<string, readonly string[]>
): readonly string[] {
	if (need.variantIds.length > 0) return need.variantIds;
	return need.variantId ? [need.variantId] : (variantIds.get(need.materialId) ?? []);
}

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
 * "Jurte (Mittelstange: Dreibein): 3× Jurtenstange fehlen" for a group with a single option or a pinned one.
 *
 * @param selection the line with the shortage
 * @param label the label of the line, see [lineLabel]
 * @param nameOf names the options, e.g. "Seil (beliebig)"
 */
export function describeShortage(
	shortage: GroupShortage,
	selection: Omit<KitSelection, 'quantity'>,
	label: string,
	nameOf: OptionName
): string {
	const group = selection.kit.groups[shortage.groupIndex];
	const pinned = activePins(selection)[shortage.groupIndex];
	const options = pinned ? [pinned] : sortedOptions(group);
	const units = shortage.missingUnits;
	const pieces = options.map(
		(option) => `${Math.ceil(units / option.unitValue)}× ${nameOf(option)}`
	);
	const part = group.name ? `${label} – ${group.name}` : label;
	if (pieces.length === 1) {
		const [only] = options;
		return `${part}: ${pieces[0]} ${Math.ceil(units / only.unitValue) === 1 ? 'fehlt' : 'fehlen'}`;
	}
	const missing = units === 1 ? '1 Einheit fehlt' : `${units} Einheiten fehlen`;
	return `${part}: ${missing} (${pieces.join(' oder ')})`;
}

/** Whether [kit] is a tent, which has sleeping places. */
export function isTent(kit: Pick<Kit, 'sleepingPlaces'>): boolean {
	return kit.sleepingPlaces != null;
}

/**
 * The sleeping use of [quantity] tents of which [notSleeping] aren't for sleeping, as a choice in a select: "Zum
 * Schlafen" / "Nicht zum Schlafen" for one tent, "Alle zum Schlafen", "2 von 3 zum Schlafen" or "Keins zum Schlafen"
 * for several.
 */
export function sleepingLabel(quantity: number, notSleeping: number): string {
	const sleeping = quantity - notSleeping;
	if (quantity === 1) return sleeping === 1 ? 'Zum Schlafen' : 'Nicht zum Schlafen';
	if (sleeping === quantity) return 'Alle zum Schlafen';
	if (sleeping === 0) return 'Keins zum Schlafen';
	return `${sleeping} von ${quantity} zum Schlafen`;
}

export interface SleepingPlaces {
	normal: number;
	/** With the tight number of the tents that have one, and the normal number of the others. */
	tight: number;
}

/** The sleeping places of one [kit]; a missing tight number is the normal one, and a kit that isn't a tent has none. */
export function kitSleepingPlaces(
	kit: Pick<Kit, 'sleepingPlaces' | 'sleepingPlacesTight'>
): SleepingPlaces {
	const normal = kit.sleepingPlaces ?? 0;
	return { normal, tight: kit.sleepingPlacesTight ?? normal };
}

/** The sleeping places of the tents for sleeping on [lines]. */
export function sleepingPlacesOf(
	lines: (Pick<PackingLine, 'quantity' | 'notSleeping'> & {
		kit: Pick<Kit, 'sleepingPlaces' | 'sleepingPlacesTight'>;
	})[]
): SleepingPlaces {
	let normal = 0;
	let tight = 0;
	for (const { kit, quantity, notSleeping } of lines) {
		const places = kitSleepingPlaces(kit);
		normal += (quantity - notSleeping) * places.normal;
		tight += (quantity - notSleeping) * places.tight;
	}
	return { normal, tight };
}

/** "4 Schlafplätze (eng 5)", leaving out the tight number where it's the same; empty without sleeping places. */
export function sleepingPlacesText({ normal, tight }: SleepingPlaces): string {
	if (normal === 0) return '';
	const places = `${normal} ${normal === 1 ? 'Schlafplatz' : 'Schlafplätze'}`;
	return tight === normal ? places : `${places} (eng ${tight})`;
}

/**
 * The weight of [needs] in grams. A need's pieces weigh what its variant weighs ([weights] by variant id); pieces of
 * any variant count with the heaviest of the material's [variantIds] (by material id). Materials without a weight
 * count as 0: most light things are never weighed. Missing pieces count too: it's the weight of the selection.
 */
export function weightOf(
	needs: Pick<MaterialNeed, 'materialId' | 'variantId' | 'required'>[],
	weights: ReadonlyMap<string, number | null>,
	variantIds: ReadonlyMap<string, readonly string[]>
): number {
	let grams = 0;
	for (const need of needs) {
		const ids = need.variantId ? [need.variantId] : (variantIds.get(need.materialId) ?? []);
		grams += need.required * Math.max(0, ...ids.map((id) => weights.get(id) ?? 0));
	}
	return grams;
}

/**
 * The summary of a packing list, e.g. "65 Schlafplätze (eng 75) · 272 kg", without the parts that are 0; empty if
 * both are.
 */
export function packingSummary(places: SleepingPlaces, grams: number): string {
	return [sleepingPlacesText(places), grams > 0 ? formatKg(grams, { total: true }) : '']
		.filter(Boolean)
		.join(' · ');
}
