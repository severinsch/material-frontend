import { describe, expect, it } from 'vitest';
import type { ItemStatus } from '#lib/api/index.js';
import { isRetired, retiredToggleLabel, visibleItems } from './items.js';

const item = (id: string, status: ItemStatus) => ({ id, status });
const items = [
	item('a', 'ACTIVE'),
	item('r', 'IN_REPAIR'),
	item('d1', 'DECOMMISSIONED'),
	item('d2', 'DECOMMISSIONED'),
	item('l', 'LOST')
];
const ids = (list: { id: string }[]) => list.map((i) => i.id);

describe('isRetired', () => {
	it('counts decommissioned and lost items as retired', () => {
		expect(items.filter(isRetired).map((i) => i.id)).toEqual(['d1', 'd2', 'l']);
	});
});

describe('visibleItems', () => {
	it('hides retired items by default', () => {
		const result = visibleItems(items, false);
		expect(ids(result.visible)).toEqual(['a', 'r']);
		expect(result.hidden).toBe(3);
		expect(result.canToggle).toBe(true);
	});

	it('shows all items when asked to', () => {
		const result = visibleItems(items, true);
		expect(ids(result.visible)).toEqual(['a', 'r', 'd1', 'd2', 'l']);
		expect(result.hidden).toBe(0);
		expect(result.canToggle).toBe(true);
	});

	it('shows highlighted retired items, e.g. search hits', () => {
		const result = visibleItems(items, false, new Set(['d2']));
		expect(ids(result.visible)).toEqual(['a', 'r', 'd2']);
		expect(result.hidden).toBe(2);
	});

	it('offers no toggle without hideable retired items', () => {
		expect(visibleItems(items.slice(0, 2), false).canToggle).toBe(false);
		expect(visibleItems([item('l', 'LOST')], false, new Set(['l'])).canToggle).toBe(false);
	});
});

describe('retiredToggleLabel', () => {
	it('shows the number of hidden items, or offers to hide them again', () => {
		expect(retiredToggleLabel({ hidden: 3 }, false)).toBe(
			'Ausgemusterte und verlorene anzeigen (3)'
		);
		expect(retiredToggleLabel({ hidden: 0 }, true)).toBe('Ausgemusterte und verlorene ausblenden');
	});
});
