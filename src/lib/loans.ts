import type { IndividualItem, Loan, Material } from '#lib/api/index.js';
import { today } from '#lib/format.js';

/** Whether [loan] is open and its due date has passed. */
export function isOverdue(loan: Loan): boolean {
	return !loan.returnedAt && !!loan.dueAt && loan.dueAt < today();
}

/** Whether [item] counts as available, as in the API's `availableCount`: active and not in POOR condition. */
export function isAvailableItem(item: IndividualItem): boolean {
	return item.status === 'ACTIVE' && item.condition !== 'POOR';
}

/**
 * What was lent, sorted by material, e.g. "30× Hering, 2× Jurtenfenster (3, 4), 4× Kohtenblatt". Specific items are
 * listed with their identifiers, quantities without.
 */
export function loanContents(
	loan: Pick<Loan, 'itemIds' | 'materials'>,
	materials: ReadonlyMap<string, Material>,
	items: ReadonlyMap<string, IndividualItem>
): string {
	const nameOf = (materialId: string) => materials.get(materialId)?.name ?? 'Unbekanntes Material';
	const lent = loan.materials.map((line) => ({
		name: nameOf(line.materialId),
		text: `${line.quantity}× ${nameOf(line.materialId)}`
	}));
	const known = loan.itemIds.map((id) => items.get(id)).filter((item) => item !== undefined);
	for (const [materialId, lentItems] of Map.groupBy(known, (item) => item.materialId)) {
		const identifiers = lentItems
			.map((item) => item.identifier)
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
		const name = nameOf(materialId);
		lent.push({ name, text: `${identifiers.length}× ${name} (${identifiers.join(', ')})` });
	}
	const unknown = loan.itemIds.length - known.length;
	const texts = lent.sort((a, b) => a.name.localeCompare(b.name)).map((part) => part.text);
	return [...texts, ...(unknown > 0 ? [`${unknown}× unbekannter Gegenstand`] : [])].join(', ');
}
