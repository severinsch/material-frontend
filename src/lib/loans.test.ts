import { describe, expect, it } from 'vitest';
import type { IndividualItem, Material } from '#lib/api/index.js';
import { loanContents } from './loans.js';

const material = (id: string, name: string) => [id, { id, name } as Material] as const;
const item = (id: string, materialId: string, identifier: string) =>
	[id, { id, materialId, identifier } as IndividualItem] as const;

const materials = new Map([
	material('hering', 'Hering'),
	material('fenster', 'Jurtenfenster'),
	material('kohte', 'Kohtenblatt')
]);
const items = new Map([item('f10', 'fenster', '10'), item('f3', 'fenster', '3')]);

describe('loanContents', () => {
	it('lists quantities and specific items by material name', () => {
		const loan = {
			itemIds: ['f10', 'f3'],
			materials: [
				{ materialId: 'kohte', quantity: 4 },
				{ materialId: 'hering', quantity: 30 }
			]
		};
		expect(loanContents(loan, materials, items)).toBe(
			'30× Hering, 2× Jurtenfenster (3, 10), 4× Kohtenblatt'
		);
	});

	it("counts items it doesn't know", () => {
		expect(loanContents({ itemIds: ['f3', 'gone'], materials: [] }, materials, items)).toBe(
			'1× Jurtenfenster (3), 1× unbekannter Gegenstand'
		);
	});
});
