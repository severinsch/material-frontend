import type { IndividualItem, Kit, Material } from '#lib/api/index.js';
import type { GroupShortage } from './allocate.js';
import { isAvailableItem } from '#lib/loans.js';

// Helpers for the packing list on the kits page: its state in the URL, where to find materials, and readable
// shortages.

/** Selected kits: kit id → quantity and the indices of the included optional groups. */
export type PackingSelection = Map<string, { quantity: number; includedGroups: Set<number> }>;

/**
 * Reads the selection from `kit` query parameters of the form `<kit id>*<quantity>` or
 * `<kit id>*<quantity>*<group index>.<group index>…` (included optional groups). `*` and `.` stay unencoded in URLs.
 * Unknown kits and malformed values are ignored.
 */
export function parseSelection(
	params: Pick<URLSearchParams, 'getAll'>,
	kits: Kit[]
): PackingSelection {
	const selection: PackingSelection = new Map();
	for (const value of params.getAll('kit')) {
		const [id, quantity, groups = ''] = value.split('*');
		const kit = kits.find((k) => k.id === id);
		const count = Number(quantity);
		if (!kit || !Number.isInteger(count) || count <= 0) continue;
		const includedGroups = new Set(
			(groups ? groups.split('.') : []).map(Number).filter((index) => kit.groups[index]?.isOptional)
		);
		selection.set(kit.id, { quantity: count, includedGroups });
	}
	return selection;
}

/** The `kit` query parameters for [selection], see [parseSelection]. */
export function serializeSelection(selection: PackingSelection): string[] {
	return [...selection].map(([id, { quantity, includedGroups }]) =>
		[id, quantity, [...includedGroups].sort((a, b) => a - b).join('.')].filter(Boolean).join('*')
	);
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
 * Where to find [material]. Individual materials are located by their usable [items] (active and not POOR, and not
 * lent out if [skipLoaned]).
 */
export function placeOf(material: Material, items: IndividualItem[], skipLoaned: boolean): Place {
	if (material.trackingType === 'BULK') {
		return {
			location: material.location?.name ?? NO_LOCATION,
			detail: material.locationDetail ?? ''
		};
	}
	const usable = items.filter(
		(item) =>
			item.materialId === material.id && isAvailableItem(item) && !(skipLoaned && item.onLoan)
	);
	const byLocation = Map.groupBy(usable, (item) => item.storageLocation?.name ?? NO_LOCATION);
	if (byLocation.size === 0) return { location: NO_LOCATION, detail: '' };
	if (byLocation.size === 1) {
		const [[location, located]] = byLocation;
		const details = [...new Set(located.map((item) => item.locationDetail).filter(Boolean))];
		return { location, detail: details.join(', ') };
	}
	const detail = [...byLocation]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([location, located]) => `${location} (${located.length})`)
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
 * "Jurte: 3× Hering fehlen" for a group with a single material.
 */
export function describeShortage(
	shortage: GroupShortage,
	kit: Kit,
	nameOf: (materialId: string) => string
): string {
	const group = kit.groups[shortage.groupIndex];
	const units = shortage.missingUnits;
	const pieces = group.options
		.toSorted((a, b) => a.priority - b.priority)
		.map((option) => `${Math.ceil(units / option.unitValue)}× ${nameOf(option.materialId)}`);
	const part = group.name ? `${kit.name} – ${group.name}` : kit.name;
	if (pieces.length === 1) {
		const [only] = group.options;
		return `${part}: ${pieces[0]} ${Math.ceil(units / only.unitValue) === 1 ? 'fehlt' : 'fehlen'}`;
	}
	const missing = units === 1 ? '1 Einheit fehlt' : `${units} Einheiten fehlen`;
	return `${part}: ${missing} (${pieces.join(' oder ')})`;
}
