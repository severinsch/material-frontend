import { describe, expect, it } from 'vitest';
import { initials, SLUG_PATTERN, suggestSlug, suggestUsername, USERNAME_PATTERN } from './names.js';

describe('suggestUsername', () => {
	it('turns names into valid usernames', () => {
		expect(suggestUsername(' Max  Müller ')).toBe('max.mueller');
		expect(suggestUsername('Zoë Weiß-Đorić')).toBe('zoe.weiss-oric');
		expect(suggestUsername('Jürgen (Materialwart)')).toBe('juergen.materialwart');
		expect(new RegExp(`^${USERNAME_PATTERN}$`).test(suggestUsername('Max Müller'))).toBe(true);
	});
});

describe('suggestSlug', () => {
	it('turns names into valid slugs', () => {
		expect(suggestSlug('Stamm St. Georg')).toBe('stamm-st-georg');
		expect(suggestSlug(' Langenbach – Süd! ')).toBe('langenbach-sued');
		expect(suggestSlug('x'.repeat(49) + ' y')).toBe('x'.repeat(49));
		expect(new RegExp(`^${SLUG_PATTERN}$`).test(suggestSlug('Stamm St. Georg'))).toBe(true);
	});
});

describe('initials', () => {
	it('takes the first and last word, or the start of a single one', () => {
		expect(initials('Max Müller')).toBe('MM');
		expect(initials('Anna von der Heide')).toBe('AH');
		expect(initials(' lena ')).toBe('LE');
	});
});
