import type { IndividualItem, NewIndividualItem } from '#lib/api/index.js';

/** Whether [item] is no longer part of the stock: decommissioned or lost. Such items stay for their history. */
export function isRetired(item: Pick<IndividualItem, 'status'>): boolean {
	return item.status === 'DECOMMISSIONED' || item.status === 'LOST';
}

/** The body to update [item] with [changes], e.g. `{ status: 'ACTIVE' }`: the API replaces all its values. */
export function itemUpdate(
	item: IndividualItem,
	changes: Partial<NewIndividualItem> = {}
): NewIndividualItem {
	return {
		variantId: item.variantId,
		identifier: item.identifier,
		condition: item.condition,
		status: item.status,
		storageLocationId: item.storageLocation?.id ?? null,
		locationDetail: item.locationDetail ?? null,
		purchasePrice: item.purchasePrice ?? null,
		purchaseDate: item.purchaseDate ?? null,
		...changes
	};
}

/** Which items of a list are shown, see [visibleItems]. */
export interface ItemVisibility<T> {
	visible: T[];
	/** The number of retired items that are hidden. */
	hidden: number;
	/** Whether showing or hiding the retired items changes anything, i.e. whether to offer the toggle. */
	canToggle: boolean;
}

/**
 * The [items] to list: retired ones (see [isRetired]) only if [showRetired], or if they are [highlighted], e.g. found
 * by a search.
 */
export function visibleItems<T extends Pick<IndividualItem, 'id' | 'status'>>(
	items: readonly T[],
	showRetired: boolean,
	highlighted?: ReadonlySet<string>
): ItemVisibility<T> {
	/** Retired items that aren't highlighted, which the toggle shows or hides. */
	const toggled = items.filter((item) => isRetired(item) && !highlighted?.has(item.id));
	const visible = showRetired ? [...items] : items.filter((item) => !toggled.includes(item));
	return { visible, hidden: showRetired ? 0 : toggled.length, canToggle: toggled.length > 0 };
}

/** The label of the toggle for the retired items, e.g. "Ausgemusterte und verlorene anzeigen (2)". */
export function retiredToggleLabel(
	{ hidden }: Pick<ItemVisibility<unknown>, 'hidden'>,
	showRetired: boolean
): string {
	return showRetired
		? 'Ausgemusterte und verlorene ausblenden'
		: `Ausgemusterte und verlorene anzeigen (${hidden})`;
}
