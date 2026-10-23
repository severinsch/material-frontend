import { describe, expect, it } from 'vitest';
import { nextIdentifier, numberedIdentifiers } from './identifiers.js';

describe('numberedIdentifiers', () => {
	it('counts upwards and keeps prefix and width', () => {
		expect(numberedIdentifiers('K08', 3)).toEqual(['K08', 'K09', 'K10']);
		expect(numberedIdentifiers('7', 2)).toEqual(['7', '8']);
		expect(numberedIdentifiers('Zelt-99', 2)).toEqual(['Zelt-99', 'Zelt-100']);
	});

	it('needs a number at the end', () => {
		expect(numberedIdentifiers('Rot', 2)).toBeNull();
	});
});

describe('nextIdentifier', () => {
	it('follows the highest number', () => {
		expect(nextIdentifier(['K01', 'K12', 'K03', 'Reserve'])).toBe('K13');
		expect(nextIdentifier(['2', '10'])).toBe('11');
	});

	it('starts at 1 without numbered identifiers', () => {
		expect(nextIdentifier([])).toBe('1');
		expect(nextIdentifier(['Rot'])).toBe('1');
	});

	it('skips taken identifiers', () => {
		expect(nextIdentifier(['K01', 'K08'], ['K09', 'K10', 'K12'])).toBe('K11');
		expect(nextIdentifier([], ['1', '2'])).toBe('3');
		expect(nextIdentifier(['K45 01'], ['K02'])).toBe('K45 02');
	});
});
