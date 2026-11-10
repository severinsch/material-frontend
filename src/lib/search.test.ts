import { describe, expect, it } from 'vitest';
import { matchesIdentifier, matchesText, matchMaterial, normalizeSearch } from './search.js';

describe('normalizeSearch', () => {
	it('trims and lowercases', () => {
		expect(normalizeSearch('  Kohte ')).toBe('kohte');
	});
});

describe('matchesText', () => {
	it('finds substrings ignoring case', () => {
		expect(matchesText('Kohtenplane', 'plane')).toBe(true);
		expect(matchesText('Kohtenplane', 'jurte')).toBe(false);
	});

	it('never matches missing texts', () => {
		expect(matchesText(null, '')).toBe(false);
		expect(matchesText(undefined, 'x')).toBe(false);
	});

	it('matches every text with an empty search', () => {
		expect(matchesText('Hering', '')).toBe(true);
	});
});

describe('matchesIdentifier', () => {
	it('finds substrings ignoring case', () => {
		expect(matchesIdentifier('K07', 'k07')).toBe(true);
		expect(matchesIdentifier('K07', 'k0')).toBe(true);
		expect(matchesIdentifier('Zelt-12', '12')).toBe(true);
		expect(matchesIdentifier('K07', 'k08')).toBe(false);
	});

	it('ignores leading zeros of a whole identifier', () => {
		expect(matchesIdentifier('K07', 'k7')).toBe(true);
		expect(matchesIdentifier('7', '007')).toBe(true);
		expect(matchesIdentifier('K45 01', 'k45 1')).toBe(true);
	});

	it("doesn't widen substrings by dropping zeros", () => {
		// "07" is in "K07" but not in "K17", although both end in 7.
		expect(matchesIdentifier('K17', '07')).toBe(false);
		expect(matchesIdentifier('K70', 'k7')).toBe(true);
		expect(matchesIdentifier('100', '1')).toBe(true);
		expect(matchesIdentifier('100', '10')).toBe(true);
	});

	it('matches nothing with an empty search', () => {
		expect(matchesIdentifier('K07', '')).toBe(false);
	});
});

describe('matchMaterial', () => {
	const items = [
		{ id: 'a', identifier: 'K07' },
		{ id: 'b', identifier: 'K17' },
		{ id: 'c', identifier: 'K08' }
	];

	it('matches by its own texts', () => {
		expect(matchMaterial('kohte', ['Kohte', null, 'Zelte'], items)).toEqual({
			matches: true,
			byText: true,
			itemIds: new Set()
		});
	});

	it('matches by item identifiers', () => {
		expect(matchMaterial('k07', ['Kohte', 'Zelte'], items)).toEqual({
			matches: true,
			byText: false,
			itemIds: new Set(['a'])
		});
		expect(matchMaterial('7', ['Kohte'], items).itemIds).toEqual(new Set(['a', 'b']));
	});

	it('reports both kinds of hits', () => {
		const match = matchMaterial('k', ['Kohte'], items);
		expect(match.byText).toBe(true);
		expect(match.itemIds.size).toBe(3);
	});

	it("doesn't match otherwise", () => {
		expect(matchMaterial('jurte', ['Kohte'], items).matches).toBe(false);
	});

	it('lists everything without item hits when nothing is searched', () => {
		expect(matchMaterial('', ['Kohte'], items)).toEqual({
			matches: true,
			byText: true,
			itemIds: new Set()
		});
	});
});
