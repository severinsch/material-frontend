import type { Material } from '#lib/api/index.js';

/** UI settings shared between pages. */
export const settings = $state({
	/** Whether pieces that are currently lent out count as unavailable. */
	subtractLoaned: true
});

/** The number of usable pieces of [stock] (a material or a variant), respecting `settings.subtractLoaned`. */
export function availableNow(stock: Pick<Material, 'availableCount' | 'loanedCount'>): number {
	const loaned = settings.subtractLoaned ? stock.loanedCount : 0;
	return Math.max(0, stock.availableCount - loaned);
}
