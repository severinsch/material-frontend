import { describe, expect, it } from 'vitest';
import type { IndividualItem, Material } from '#lib/api/index.js';
import { variantsById } from './format.js';
import { loanContents } from './loans.js';

const material = (id: string, name: string, ...variants: string[]) =>
	({
		id,
		name,
		variants: variants.length
			? variants.map((variant) => ({ id: `${id} ${variant}`, name: variant }))
			: [{ id, name: null }]
	}) as Material;
const item = (id: string, variantId: string, identifier: string) =>
	[id, { id, variantId, identifier } as IndividualItem] as const;

const variants = variantsById([
	material('hering', 'Hering'),
	material('fenster', 'Jurtenfenster'),
	material('kohte', 'Kohtenblatt'),
	material('seil', 'Seil', '10 m', '15 m'),
	material('plane', 'Kohtenplane', 'ohne Latz', '45 cm Latz')
]);
const items = new Map([
	item('f10', 'fenster', '10'),
	item('f3', 'fenster', '3'),
	item('k1', 'plane 45 cm Latz', 'K45 01'),
	item('k2', 'plane ohne Latz', 'K01')
]);

describe('loanContents', () => {
	it('lists quantities and specific items by material name', () => {
		const loan = {
			itemIds: ['f10', 'f3'],
			materials: [
				{ variantId: 'kohte', quantity: 4 },
				{ variantId: 'hering', quantity: 30 }
			]
		};
		expect(loanContents(loan, variants, items)).toBe(
			'30× Hering, 2× Jurtenfenster (3, 10), 4× Kohtenblatt'
		);
	});

	it('names the variants of materials with several', () => {
		const loan = {
			itemIds: ['k1', 'k2'],
			materials: [
				{ variantId: 'seil 15 m', quantity: 2 },
				{ variantId: 'seil 10 m', quantity: 1 }
			]
		};
		expect(loanContents(loan, variants, items)).toBe(
			'1× Kohtenplane 45 cm Latz (K45 01), 1× Kohtenplane ohne Latz (K01), 1× Seil 10 m, 2× Seil 15 m'
		);
	});

	it("counts items it doesn't know", () => {
		expect(loanContents({ itemIds: ['f3', 'gone'], materials: [] }, variants, items)).toBe(
			'1× Jurtenfenster (3), 1× unbekannter Gegenstand'
		);
	});
});
