import type {
	IndividualItem,
	ItemCondition,
	ItemStatus,
	Material,
	StorageLocation,
	Variant
} from '#lib/api/index.js';

export const conditionLabels: Record<ItemCondition, string> = {
	NEW: 'Neu',
	GOOD: 'Gut',
	FAIR: 'Gebraucht',
	POOR: 'Schlecht'
};

export const statusLabels: Record<ItemStatus, string> = {
	ACTIVE: 'Aktiv',
	IN_REPAIR: 'In Reparatur',
	LOST: 'Verloren',
	DECOMMISSIONED: 'Ausgemustert'
};

export const trackingTypeLabels: Record<Material['trackingType'], string> = {
	BULK: 'Nach Menge',
	INDIVIDUAL: 'Einzeln'
};

// Names of variants and items, built here so the format can change in one place. Like the backend
// (services/Names.kt), a variant's name is only included if its material has several variants, since the UI doesn't
// show variants otherwise: "Seil 15 m" and "Kohtenplane 45 cm Latz K45 01", but "Hering" and "Kohtenblatt 3".

/** A material with its variants, as far as needed for names. */
type Named = Pick<Material, 'name'> & { variants: readonly Pick<Variant, 'name'>[] };

/** E.g. "Seil 15 m"; just the material's name if it has a single variant. */
export function variantName(material: Named, variant: Pick<Variant, 'name'>): string {
	return material.variants.length > 1 && variant.name
		? `${material.name} ${variant.name}`
		: material.name;
}

/** E.g. "Kohtenplane 45 cm Latz K45 01", or "Kohtenblatt 3" if the material has a single variant. */
export function itemName(
	material: Named,
	variant: Pick<Variant, 'name'>,
	item: Pick<IndividualItem, 'identifier'>
): string {
	return `${variantName(material, variant)} ${item.identifier}`;
}

/** A variant together with its material. */
export interface VariantOf {
	material: Material;
	variant: Variant;
}

/** The variants of [materials] by id, with their material: the counterpart of a material lookup by id. */
export function variantsById(materials: Material[]): Map<string, VariantOf> {
	return new Map(
		materials.flatMap((material) =>
			material.variants.map((variant) => [variant.id, { material, variant }] as const)
		)
	);
}

/** The name of the variant [variantId], looked up in [variants] (see [variantsById]). */
export function variantNameOf(variants: ReadonlyMap<string, VariantOf>, variantId: string): string {
	const found = variants.get(variantId);
	return found ? variantName(found.material, found.variant) : 'Unbekanntes Material';
}

/** The name of [item], looking up its variant in [variants] (see [variantsById]). */
export function itemNameOf(
	variants: ReadonlyMap<string, VariantOf>,
	item: Pick<IndividualItem, 'variantId' | 'identifier'>
): string {
	return `${variantNameOf(variants, item.variantId)} ${item.identifier}`;
}

/** Select options for a label record. */
export function optionsOf<T extends string>(labels: Record<T, string>) {
	return Object.entries<string>(labels).map(([value, label]) => ({ value: value as T, label }));
}

// Users are in Germany. A fixed locale and time zone make server-rendered dates match the ones rendered in the browser.
const dateFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'Europe/Berlin',
	dateStyle: 'medium'
});
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'Europe/Berlin',
	dateStyle: 'medium',
	timeStyle: 'short'
});
const isoDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }); // YYYY-MM-DD
const priceFormat = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

/** Formats a date (`2026-10-01`) or a timestamp for display. */
export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	// A date without time is placed at noon UTC, which is the same day in Berlin.
	return value.length === 10
		? dateFormat.format(new Date(`${value}T12:00Z`))
		: dateFormat.format(new Date(value));
}

/** Formats a timestamp with its time, e.g. "18.10.2026, 14:30". */
export function formatDateTime(value: string): string {
	return dateTimeFormat.format(new Date(value));
}

/** Formats a price in euros, e.g. "0,35 €". */
export function formatPrice(value: number | null | undefined): string {
	return value == null ? '—' : priceFormat.format(value);
}

/** Today's date in Germany as `YYYY-MM-DD`. */
export function today(): string {
	return isoDateFormat.format(new Date());
}

/** A trimmed form value, or null if it's empty. */
export function orNull(value: string | null | undefined): string | null {
	return value?.trim() || null;
}

/** Select options for an optional storage location. */
export function locationOptions(locations: StorageLocation[]) {
	return [
		{ value: '', label: 'Keiner' },
		...locations.map((l) => ({ value: l.id, label: l.name }))
	];
}
