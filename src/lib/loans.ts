import type { IndividualItem, Loan, Material } from '#lib/api/index.js';
import { today } from '#lib/format.js';

/** Whether [loan] is open and its due date has passed. */
export function isOverdue(loan: Loan): boolean {
	return !loan.returnedAt && !!loan.dueAt && loan.dueAt < today();
}

/**
 * What was lent, e.g. "2× Jurtenfenster (3, 4), 30× Hering". Items are grouped by material and sorted by identifier.
 */
export function loanContents(
	loan: Pick<Loan, 'itemIds' | 'bulkMaterials'>,
	materials: ReadonlyMap<string, Material>,
	items: ReadonlyMap<string, IndividualItem>
): string {
	const nameOf = (materialId: string) => materials.get(materialId)?.name ?? 'Unbekanntes Material';
	const identifiersByMaterial = new Map<string, string[]>();
	let unknownItems = 0;
	for (const id of loan.itemIds) {
		const item = items.get(id);
		if (!item) {
			unknownItems++;
			continue;
		}
		const identifiers = identifiersByMaterial.get(item.materialId) ?? [];
		identifiers.push(item.identifier);
		identifiersByMaterial.set(item.materialId, identifiers);
	}
	const lentItems = [...identifiersByMaterial].map(([materialId, identifiers]) => {
		const sorted = identifiers.toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }));
		return `${sorted.length}× ${nameOf(materialId)} (${sorted.join(', ')})`;
	});
	const lentBulk = loan.bulkMaterials.map((line) => `${line.quantity}× ${nameOf(line.materialId)}`);
	const unknown = unknownItems > 0 ? [`${unknownItems}× unbekannter Gegenstand`] : [];
	return [...lentItems, ...lentBulk, ...unknown].join(', ');
}
