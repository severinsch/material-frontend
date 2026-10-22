import { describe, expect, it } from 'vitest';
import type { Kit } from '#lib/api/index.js';
import { kitsAfterMerge, splitNames, suggestMerge } from './merge.js';

describe('splitNames', () => {
	it('splits off the common words', () => {
		expect(splitNames(['Seil 10 m', 'Seil 15 m', 'Seil 20 m'])).toEqual({
			prefix: 'Seil',
			remainders: ['10 m', '15 m', '20 m']
		});
		expect(splitNames(['Zelt SG 20', 'Zelt SG 30'])).toEqual({
			prefix: 'Zelt SG',
			remainders: ['20', '30']
		});
	});

	it('splits at whole words only', () => {
		expect(splitNames(['Seil 10 m', 'Seil 15 m']).prefix).toBe('Seil');
		expect(splitNames(['Kanister 10 L', 'Kanister 10 l']).prefix).toBe('Kanister 10 L');
		expect(splitNames(['Seilbahn', 'Seil 10 m'])).toEqual({
			prefix: '',
			remainders: ['Seilbahn', 'Seil 10 m']
		});
	});

	it('ignores case and extra spaces, spelling the prefix like the first name', () => {
		expect(splitNames(['  Seil  10 m ', 'seil 15 m'])).toEqual({
			prefix: 'Seil',
			remainders: ['10 m', '15 m']
		});
	});

	it('drops separators and parentheses around the remainder', () => {
		expect(splitNames(['Seil - 10 m', 'Seil - 15 m'])).toEqual({
			prefix: 'Seil',
			remainders: ['10 m', '15 m']
		});
		expect(splitNames(['Kanister (10 L)', 'Kanister (20 L)'])).toEqual({
			prefix: 'Kanister',
			remainders: ['10 L', '20 L']
		});
		expect(splitNames(['Plane (alt) groß', 'Plane (neu) groß']).remainders).toEqual([
			'(alt) groß',
			'(neu) groß'
		]);
		expect(splitNames(['- 10 m', '- 15 m'])).toEqual({ prefix: '', remainders: ['10 m', '15 m'] });
	});

	it('leaves an empty remainder for a name that is the prefix', () => {
		expect(splitNames(['Kohtenplane', 'Kohtenplane 45 cm Latz'])).toEqual({
			prefix: 'Kohtenplane',
			remainders: ['', '45 cm Latz']
		});
	});
});

describe('suggestMerge', () => {
	const material = (name: string, ...variants: [string, string | null][]) => ({
		name,
		variants: variants.map(([id, name]) => ({ id, name }))
	});

	it('names single unnamed variants after the rest of their material name', () => {
		const { name, variantNames } = suggestMerge([
			material('Seil 10 m', ['a', null]),
			material('Seil 15 m', ['b', null]),
			material('Seil 20 m', ['c', null])
		]);
		expect(name).toBe('Seil');
		expect([...variantNames]).toEqual([
			['a', '10 m'],
			['b', '15 m'],
			['c', '20 m']
		]);
	});

	it('keeps the names of named variants', () => {
		const { name, variantNames } = suggestMerge([
			material('Seil', ['a', '10 m'], ['b', '15 m']),
			material('Seil 20 m', ['c', null]),
			material('Seil grün', ['d', 'lang'])
		]);
		expect(name).toBe('Seil');
		expect([...variantNames]).toEqual([
			['a', '10 m'],
			['b', '15 m'],
			['c', '20 m'],
			['d', 'lang']
		]);
	});

	it("takes the target's name without a common start", () => {
		const { name, variantNames } = suggestMerge([
			material('Tau', ['a', null]),
			material('Seil', ['b', null])
		]);
		expect(name).toBe('Tau');
		expect([...variantNames.values()]).toEqual(['Tau', 'Seil']);
	});
});

describe('kitsAfterMerge', () => {
	type Option = [string, string | null];
	/** A kit with one group per list of options. */
	const kit = (name: string, ...groups: Option[][]) =>
		({
			id: name,
			name,
			groups: groups.map((options) => ({
				amounts: [],
				options: options.map(([materialId, variantId]) => ({
					materialId,
					variantId,
					unitValue: 1,
					priority: 0
				}))
			}))
		}) as Kit;
	const kits = [
		kit('Wasser', [['kanister', null]]),
		kit('Lager', [['kanister', 'kanister-10']], [['klein', null]]),
		kit('Jurte', [['seil', null]]),
		kit('Kohte', [['hering', null]])
	];
	const kanister = { id: 'kanister', name: 'Kanister', variants: [{}, {}] };
	const klein = { id: 'klein', name: 'Kanister klein', variants: [{}] };

	it('lists the kits using the materials', () => {
		const withoutAny = [kit('Wasser', [['kanister', 'kanister-20']]), ...kits.slice(1)];
		expect(kitsAfterMerge(withoutAny, [klein, kanister])).toEqual({
			same: ['Lager', 'Wasser'],
			widened: [],
			blocked: []
		});
	});

	it("tells the kits that use any variant of a target with several, which gain the sources' variants", () => {
		expect(kitsAfterMerge(kits, [kanister, klein])).toEqual({
			same: ['Lager'],
			widened: ['Wasser'],
			blocked: []
		});
	});

	it('blocks kits that use any variant of a source with several, like the API', () => {
		const withLager = [
			...kits,
			kit('Zeltlager', [
				['kanister', null],
				['seil', null]
			])
		];
		expect(kitsAfterMerge(withLager, [klein, kanister])).toEqual({
			same: ['Lager'],
			widened: [],
			blocked: [
				'Kanister wird in den Sets Wasser, Zeltlager mit beliebiger Variante verwendet, was sich nach ' +
					'dem Zusammenführen nicht mehr ausdrücken lässt. Wähle dort zuerst bestimmte Varianten aus, ' +
					'oder führe die anderen Materialien in dieses zusammen.'
			]
		});
	});

	it('blocks kits with any variant of a target with several in a group that lists a source, like the API', () => {
		// In separate groups, the target's variants just include the source's afterwards.
		const separate = kit('Küche', [['kanister', null]], [['klein', null]]);
		const together = kit('Wasserstelle', [
			['kanister', null],
			['klein', 'klein-1']
		]);
		expect(kitsAfterMerge([...kits, separate, together], [kanister, klein])).toEqual({
			same: ['Lager'],
			widened: ['Küche', 'Wasser'],
			blocked: [
				'Kanister wird im Set Wasserstelle mit beliebiger Variante verwendet, zusammen mit einem der ' +
					'anderen Materialien im selben Teil. Danach würden sich die Materialien des Teils überschneiden. ' +
					'Entferne zuerst eines davon aus dem Teil.'
			]
		});
	});
});
