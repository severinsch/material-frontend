import type { Material } from '#lib/api/index.js';

/** UI settings shared between pages. */
export const settings = $state({
	/** Whether pieces that are currently lent out count as unavailable. */
	subtractLoaned: true
});

/** The number of usable pieces of [material], respecting `settings.subtractLoaned`. */
export function availableNow(material: Material): number {
	const loaned = settings.subtractLoaned ? material.loanedCount : 0;
	return Math.max(0, material.availableCount - loaned);
}
