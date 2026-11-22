import { describe, expect, it } from 'vitest';
import type { Material } from '#lib/api/index.js';
import {
	autoIdentifiers,
	compactList,
	countAtEnd,
	matchMaterial,
	parseLine,
	parseList,
	planEntry,
	similarMaterials,
	type Draft
} from './quick-entry.js';

const read = (line: string) => {
	const { name, count, identifiers, start, individual, problem } = parseLine(line);
	return { name, count, identifiers, start, individual, problem };
};

describe('parseLine', () => {
	it('reads a count at the start', () => {
		expect(read('40 Heringe')).toMatchObject({ name: 'Heringe', count: 40, individual: false });
		expect(read('40x Heringe')).toMatchObject({ name: 'Heringe', count: 40 });
		expect(read('40 Stk. Heringe')).toMatchObject({ name: 'Heringe', count: 40 });
		expect(read('Heringe')).toMatchObject({ name: 'Heringe', count: 1 });
	});

	it('keeps numbers elsewhere in the name', () => {
		expect(read('Heringe 40')).toMatchObject({ name: 'Heringe 40', count: 1 });
		expect(read('Seil 15 m')).toMatchObject({ name: 'Seil 15 m', identifiers: null });
		expect(read('2 Kochtopf 20 L')).toMatchObject({ name: 'Kochtopf 20 L', count: 2 });
		expect(read('Jurte 2')).toMatchObject({ name: 'Jurte 2', individual: false });
		expect(read('3-Bein-Hocker')).toMatchObject({ name: '3-Bein-Hocker', count: 1 });
		expect(read('Erste-Hilfe-Kasten')).toMatchObject({ name: 'Erste-Hilfe-Kasten' });
		expect(read('Topf groß, rund')).toMatchObject({ name: 'Topf groß, rund', identifiers: null });
		// Decimals and sizes, not item numbers.
		expect(read('Spanngurt 2,5')).toMatchObject({ name: 'Spanngurt 2,5', individual: false });
		expect(read('Kabel 3x1,5')).toMatchObject({ name: 'Kabel 3x1,5', individual: false });
		expect(read('Isomatte 180-200')).toMatchObject({ name: 'Isomatte 180-200', individual: false });
		expect(read('Zelt 2-3')).toMatchObject({ name: 'Zelt 2-3', individual: false });
	});

	it('reads "einzeln" and "ab"', () => {
		expect(read('5 Gaskocher einzeln')).toMatchObject({
			name: 'Gaskocher',
			count: 5,
			individual: true
		});
		expect(read('4 Laterne ab 10')).toMatchObject({
			name: 'Laterne',
			count: 4,
			start: '10',
			individual: true
		});
	});

	it('reads marked lists of labels', () => {
		expect(read('Kohtenplane K09-K11')).toMatchObject({
			name: 'Kohtenplane',
			count: 3,
			identifiers: ['K09', 'K10', 'K11'],
			individual: true
		});
		expect(read('Kohtenplane K09 - 11').identifiers).toEqual(['K09', 'K10', 'K11']);
		expect(read('Kohtenplane #1-3, 7').identifiers).toEqual(['1', '2', '3', '7']);
		expect(read('Kohtenplane #7, 9').identifiers).toEqual(['7', '9']);
		expect(read('Kohtenplane Nr. 1-3').identifiers).toEqual(['1', '2', '3']);
		expect(read('Kohtenplane #7').identifiers).toEqual(['7']);
		expect(read('Kohtenplane Nr. 7').identifiers).toEqual(['7']);
		expect(read('Kohtenplane #Rot')).toMatchObject({ name: 'Kohtenplane', identifiers: ['Rot'] });
		expect(read('Kohtenplane #1-2, Rot').identifiers).toEqual(['1', '2', 'Rot']);
		expect(read('2 Erste-Hilfe-Kasten #3-4')).toMatchObject({
			name: 'Erste-Hilfe-Kasten',
			count: 2
		});
	});

	it('names problems instead of guessing', () => {
		expect(read('3 Kohte K01-K05').problem).toBe('3 angegeben, aber 5 Nummern.');
		expect(read('Kohte #K12-K10')).toMatchObject({
			name: 'Kohte',
			problem: 'Die Nummern „K12-K10“ sind nicht lesbar.'
		});
	});

	it('knows where the name is', () => {
		const line = '5 plane einzeln';
		const { nameStart, nameEnd } = parseLine(line);
		expect(line.slice(nameStart, nameEnd)).toBe('plane');
	});

	it('has no count without a name', () => {
		expect(read('')).toMatchObject({ name: '', count: null });
		expect(read('  ')).toMatchObject({ name: '', count: null });
	});
});

describe('lists', () => {
	it('parses and compacts', () => {
		expect(parseList('K01-03, Rot')).toEqual(['K01', 'K02', 'K03', 'Rot']);
		expect(parseList('K45 01-K45 03, Großes Zelt')).toEqual([
			'K45 01',
			'K45 02',
			'K45 03',
			'Großes Zelt'
		]);
		expect(parseList('K12-K10')).toBeNull();
		expect(compactList(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'])).toBe('1–11');
		expect(compactList(['K08', 'K09', 'K10'])).toBe('K08–K10');
		expect(compactList(['7', '8', '10'])).toBe('7, 8, 10');
		expect(compactList(['1', '2', '3', 'Rot'])).toBe('1–3, Rot');
	});

	it('numbers automatically', () => {
		expect(autoIdentifiers(['K01', 'K08'], null, 3)).toEqual(['K09', 'K10', 'K11']);
		expect(autoIdentifiers([], null, 2)).toEqual(['1', '2']);
		expect(autoIdentifiers([], '10', 2)).toEqual(['10', '11']);
		expect(autoIdentifiers([], 'Rot', 2)).toBeNull();
	});
});

describe('matching', () => {
	const material = (name: string, variants: (string | null)[], archived = false) =>
		({
			trackingType: 'BULK',
			id: name,
			name,
			archivedAt: archived ? '2026-01-01T00:00:00Z' : null,
			availableCount: 0,
			damagedCount: 0,
			loanedCount: 0,
			variants: variants.map((v) => ({
				id: `${name}/${v}`,
				name: v,
				availableCount: 0,
				damagedCount: 0,
				loanedCount: 0
			}))
		}) as Material;
	const materials = [
		material('Heringe', [null]),
		material('Seil', ['10 m', '15 m']),
		material('Säge', [null], true),
		material('Kohtenplane', [null]),
		material('Leine', ['5 m'])
	];

	it('matches display names case-insensitively', () => {
		expect(matchMaterial(materials, ' heringe ')).toMatchObject({
			kind: 'existing',
			material: { name: 'Heringe' }
		});
		expect(matchMaterial(materials, 'Seil 15 m')).toMatchObject({
			kind: 'existing',
			variant: { name: '15 m' }
		});
		expect(matchMaterial(materials, 'Zelt')).toEqual({ kind: 'new' });
	});

	it('asks for the variant and refuses archived materials', () => {
		expect(matchMaterial(materials, 'Seil')).toMatchObject({ kind: 'variants' });
		// Even with a single, named variant.
		expect(matchMaterial(materials, 'Leine')).toMatchObject({ kind: 'variants' });
		expect(matchMaterial(materials, 'Leine 5 m')).toMatchObject({ kind: 'existing' });
		expect(matchMaterial(materials, 'Säge')).toMatchObject({ kind: 'archived' });
	});

	it('suggests similar names', () => {
		expect(similarMaterials(materials, 'plane').map((s) => s.label)).toEqual(['Kohtenplane']);
		expect(similarMaterials(materials, 'seil').map((s) => s.label)).toEqual([
			'Seil 10 m',
			'Seil 15 m'
		]);
		expect(similarMaterials(materials, 'sä')).toEqual([]);
		expect(similarMaterials(materials, 'h')).toEqual([]);
	});

	it('notices a count typed at the end', () => {
		expect(countAtEnd(materials, 'Heringe 40')).toBe('40 Heringe');
		expect(countAtEnd(materials, 'Zelt 3')).toBeNull();
		expect(countAtEnd(materials, 'Seil 15')).toBeNull();
		expect(countAtEnd(materials, 'Heringe')).toBeNull();
	});
});

describe('planEntry', () => {
	const bulk = (name: string, available: number) =>
		({
			trackingType: 'BULK',
			id: name,
			name,
			archivedAt: null,
			availableCount: available,
			damagedCount: 0,
			loanedCount: 0,
			variants: [
				{ id: `${name}/v`, name: null, availableCount: available, damagedCount: 0, loanedCount: 0 }
			]
		}) as Material;
	const individual = (name: string) =>
		({ ...bulk(name, 0), trackingType: 'INDIVIDUAL' }) as Material;
	const materials = [bulk('Heringe', 80), individual('Kohtenplane')];
	const items = ['K01', 'K02', 'K05'].map((identifier) => ({
		variantId: 'Kohtenplane/v',
		identifier
	}));
	const draft = (changes: Partial<Draft>): Draft => ({
		name: '',
		count: 1,
		kind: 'BULK',
		identifiers: null,
		start: null,
		category: '',
		...changes
	});
	const plan = (changes: Partial<Draft>) => planEntry(materials, items, draft(changes));

	it('adds to existing materials, whose type wins', () => {
		expect(plan({ name: 'heringe', count: 40 })).toMatchObject({
			match: { kind: 'existing' },
			kind: 'BULK',
			count: 40,
			problem: null
		});
		expect(plan({ name: 'Kohtenplane', count: 2, kind: 'BULK' })).toMatchObject({
			kind: 'INDIVIDUAL',
			identifiers: ['K06', 'K07'],
			taken: ['K01', 'K02', 'K05'],
			problem: null
		});
	});

	it('creates new materials, numbered from 1 or a start', () => {
		expect(plan({ name: 'Gaskocher', count: 3, kind: 'INDIVIDUAL' })).toMatchObject({
			match: { kind: 'new' },
			identifiers: ['1', '2', '3'],
			count: 3
		});
		expect(plan({ name: 'Zelt', count: 2, kind: 'INDIVIDUAL', start: 'K01' }).identifiers).toEqual([
			'K01',
			'K02'
		]);
	});

	it('is incomplete without a name or count', () => {
		expect(plan({ name: '' }).problem).toBe('');
		expect(plan({ name: 'Seil', count: null }).problem).toBe('');
		expect(plan({ name: 'Seil', count: 0, kind: 'INDIVIDUAL' }).problem).toBe('');
	});

	it('names what is wrong', () => {
		expect(plan({ name: 'Kohtenplane', identifiers: ['K02', 'K03'] }).problem).toBe(
			'K02 gibt es schon.'
		);
		expect(plan({ name: 'Zelt', kind: 'INDIVIDUAL', identifiers: ['1', '1'] }).problem).toBe(
			'Eine Nummer steht doppelt da.'
		);
		expect(plan({ name: 'Heringe', identifiers: ['1'] }).problem).toBe(
			'Heringe wird nur gezählt, ohne Nummern.'
		);
		expect(plan({ name: 'Seil', count: 10000 }).problem).toBe('Höchstens 9999 auf einmal.');
		expect(plan({ name: 'Zelt', kind: 'INDIVIDUAL', count: 101 }).problem).toBe(
			'Höchstens 100 Stück auf einmal.'
		);
		expect(plan({ name: 'Zelt', kind: 'INDIVIDUAL', count: 2, start: 'Rot' }).problem).toBe(
			'Nummern müssen mit einer Zahl enden, z. B. K01.'
		);
	});
});
