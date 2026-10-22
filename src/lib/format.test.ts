import { describe, expect, it } from 'vitest';
import type { Material } from '#lib/api/index.js';
import {
	itemName,
	itemNameOf,
	variantName,
	variantNameOf,
	variantOf,
	variantsById,
	variantsError
} from './format.js';

const seil = {
	id: 'seil',
	name: 'Seil',
	variants: [
		{ id: 'seil-10', name: '10 m' },
		{ id: 'seil-15', name: '15 m' }
	]
} as Material;
const plane = {
	id: 'plane',
	name: 'Kohtenplane',
	variants: [{ id: 'plane-1', name: null }]
} as Material;
const named = {
	id: 'blatt',
	name: 'Kohtenblatt',
	variants: [{ id: 'blatt-1', name: 'grün' }]
} as Material;

describe('names', () => {
	it('includes the variant only if the material has several', () => {
		expect(variantName(seil, seil.variants[1])).toBe('Seil 15 m');
		expect(variantName(plane, plane.variants[0])).toBe('Kohtenplane');
		// A single named variant isn't shown either, as in the backend.
		expect(variantName(named, named.variants[0])).toBe('Kohtenblatt');
	});

	it('names items by their variant and identifier', () => {
		expect(itemName(seil, seil.variants[0], { identifier: 'S1' })).toBe('Seil 10 m S1');
		expect(itemName(plane, plane.variants[0], { identifier: 'K01' })).toBe('Kohtenplane K01');
	});

	it('looks variants up by id', () => {
		const variants = variantsById([seil, plane]);
		expect(variants.get('seil-15')?.material).toBe(seil);
		expect(variantNameOf(variants, 'seil-10')).toBe('Seil 10 m');
		expect(variantNameOf(variants, 'gone')).toBe('Unbekanntes Material');
		expect(itemNameOf(variants, { variantId: 'plane-1', identifier: 'K02' })).toBe(
			'Kohtenplane K02'
		);
	});

	it("looks up a material's variant, unnamed if it's gone", () => {
		expect(variantOf(seil, 'seil-15')).toBe(seil.variants[1]);
		expect(variantOf(seil, 'gone')).toEqual({ name: null });
		expect(variantName(seil, variantOf(seil, 'gone'))).toBe('Seil');
	});
});

describe('variantsError', () => {
	it('accepts a single variant with or without a name', () => {
		expect(variantsError([''])).toBeUndefined();
		expect(variantsError(['10 m'])).toBeUndefined();
		expect(variantsError(['10 m', '15 m'])).toBeUndefined();
	});

	it('needs a name for each of several variants, like the API', () => {
		expect(variantsError(['10 m', ' '])).toBe(
			'Hat ein Material mehrere Varianten, braucht jede einen Namen.'
		);
	});

	it('needs distinct names, compared as sent (trimmed, case-sensitive)', () => {
		expect(variantsError(['10 m', '10 m '])).toBe(
			'Die Varianten eines Materials brauchen unterschiedliche Namen.'
		);
		expect(variantsError(['groß', 'Groß'])).toBeUndefined();
	});
});
