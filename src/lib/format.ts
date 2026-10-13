import type { ItemCondition, ItemStatus, Material, StorageLocation } from '#lib/api/index.js';

export const conditionLabels: Record<ItemCondition, string> = {
	NEW: 'New',
	GOOD: 'Good',
	FAIR: 'Fair',
	POOR: 'Poor'
};

export const statusLabels: Record<ItemStatus, string> = {
	ACTIVE: 'Active',
	IN_REPAIR: 'In repair',
	LOST: 'Lost',
	DECOMMISSIONED: 'Decommissioned'
};

export const trackingTypeLabels: Record<Material['trackingType'], string> = {
	BULK: 'Bulk',
	INDIVIDUAL: 'Individual'
};

/** Select options for a label record. */
export function optionsOf<T extends string>(labels: Record<T, string>) {
	return Object.entries<string>(labels).map(([value, label]) => ({ value: value as T, label }));
}

// Users are in Germany. A fixed locale and time zone make server-rendered dates match the ones rendered in the browser.
const dateFormat = new Intl.DateTimeFormat('de-DE', {
	timeZone: 'Europe/Berlin',
	dateStyle: 'medium'
});
const isoDateFormat = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }); // YYYY-MM-DD

/** Formats a date (`2026-10-01`) or a timestamp for display. */
export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	// A date without time is placed at noon UTC, which is the same day in Berlin.
	return value.length === 10
		? dateFormat.format(new Date(`${value}T12:00Z`))
		: dateFormat.format(new Date(value));
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
	return [{ value: '', label: 'None' }, ...locations.map((l) => ({ value: l.id, label: l.name }))];
}
