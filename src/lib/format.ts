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

/** Formats a date (`2026-10-01`, read as local date) or a timestamp for display. */
export function formatDate(value: string | null | undefined): string {
	if (!value) return '—';
	return new Date(value.length === 10 ? `${value}T00:00` : value).toLocaleDateString();
}

/** Today's local date as `YYYY-MM-DD`. */
export function today(): string {
	const now = new Date();
	return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** A trimmed form value, or null if it's empty. */
export function orNull(value: string | null | undefined): string | null {
	return value?.trim() || null;
}

/** Select options for an optional storage location. */
export function locationOptions(locations: StorageLocation[]) {
	return [{ value: '', label: 'None' }, ...locations.map((l) => ({ value: l.id, label: l.name }))];
}
