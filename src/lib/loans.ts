import type { IndividualItem, Loan } from '#lib/api/index.js';
import { today, variantNameOf, type VariantOf } from '#lib/format.js';

/** Whether [loan] is open and its due date has passed. */
export function isOverdue(loan: Loan): boolean {
	return !loan.returnedAt && !!loan.dueAt && loan.dueAt < today();
}

/** Whether [item] counts as available, as in the API's `availableCount`: active and not in POOR condition. */
export function isAvailableItem(item: IndividualItem): boolean {
	return item.status === 'ACTIVE' && item.condition !== 'POOR';
}

/**
 * What was lent, sorted by name, e.g. "30× Hering, 2× Jurtenfenster (3, 4), 4× Seil 15 m". Specific items are listed
 * with their identifiers, quantities without.
 *
 * @param variants the variants by id with their material, see `variantsById`
 */
export function loanContents(
	loan: Pick<Loan, 'itemIds' | 'materials'>,
	variants: ReadonlyMap<string, VariantOf>,
	items: ReadonlyMap<string, IndividualItem>
): string {
	const nameOf = (variantId: string) => variantNameOf(variants, variantId);
	const lent = loan.materials.map((line) => ({
		name: nameOf(line.variantId),
		text: `${line.quantity}× ${nameOf(line.variantId)}`
	}));
	const known = loan.itemIds.map((id) => items.get(id)).filter((item) => item !== undefined);
	for (const [variantId, lentItems] of Map.groupBy(known, (item) => item.variantId)) {
		const identifiers = lentItems
			.map((item) => item.identifier)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
		const name = nameOf(variantId);
		lent.push({ name, text: `${identifiers.length}× ${name} (${identifiers.join(', ')})` });
	}
	const unknown = loan.itemIds.length - known.length;
	const texts = lent
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
		.map((part) => part.text);
	return [...texts, ...(unknown > 0 ? [`${unknown}× unbekannter Gegenstand`] : [])].join(', ');
}
