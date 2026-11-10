import { describe, expect, it } from 'vitest';
import { categoriesOf, suggestCategories } from './categories.js';

const materials = (...categories: (string | null)[]) =>
	categories.map((category, index) => ({ id: `m${index}`, category }));

describe('categoriesOf', () => {
	it('counts each spelling as its own category, ignoring surrounding spaces', () => {
		expect(categoriesOf(materials('Zelte', 'zelte', ' Zelte ', 'Kochen', null, '  '))).toEqual([
			{ name: 'Zelte', count: 2 },
			{ name: 'Kochen', count: 1 },
			{ name: 'zelte', count: 1 }
		]);
	});

	it('sorts by use, then by name', () => {
		const names = categoriesOf(materials('Werkzeug', 'Kochen', 'Zelte', 'Zelte')).map(
			(c) => c.name
		);
		expect(names).toEqual(['Zelte', 'Kochen', 'Werkzeug']);
	});
});

describe('suggestCategories', () => {
	const categories = categoriesOf(
		materials(
			'Zelte',
			'Zelte',
			'Zeltzubehör',
			'Kochen',
			'Kochen',
			'Kochen',
			'Erste Hilfe',
			'Werkzeug'
		)
	);

	it('suggests the most used ones without input', () => {
		expect(suggestCategories(categories, '', 3)).toEqual(['Kochen', 'Zelte', 'Erste Hilfe']);
		expect(suggestCategories(categories, '   ', 3)).toEqual(['Kochen', 'Zelte', 'Erste Hilfe']);
	});

	it('matches ignoring case, those starting with the input first', () => {
		expect(suggestCategories(categories, 'zelt')).toEqual(['Zelte', 'Zeltzubehör']);
		expect(suggestCategories(categories, 'hilfe')).toEqual(['Erste Hilfe']);
		expect(suggestCategories(categories, 'e')).toEqual([
			'Erste Hilfe',
			'Kochen',
			'Zelte',
			'Werkzeug',
			'Zeltzubehör'
		]);
	});

	it('suggests the existing spelling for a different one', () => {
		expect(suggestCategories(categories, 'zelte ')).toEqual(['Zelte']);
	});

	it('suggests nothing for an existing category or no match', () => {
		expect(suggestCategories(categories, 'Zelte')).toEqual([]);
		expect(suggestCategories(categories, ' Zelte ')).toEqual([]);
		expect(suggestCategories(categories, 'Spiele')).toEqual([]);
	});
});
