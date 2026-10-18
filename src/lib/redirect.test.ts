import { describe, expect, it } from 'vitest';
import { loginPath, safeRedirectTarget } from './redirect.js';

describe('safeRedirectTarget', () => {
	it('keeps paths on this site', () => {
		expect(safeRedirectTarget('/stamm/materials/1?x=1#y')).toBe('/stamm/materials/1?x=1#y');
		expect(safeRedirectTarget('/')).toBe('/');
	});

	it('rejects targets that lead elsewhere', () => {
		for (const target of [
			null,
			'',
			'https://evil.example/',
			'//evil.example/',
			'/\\evil.example/',
			'/\t/evil.example/',
			'/\n/evil.example/',
			'\\\\evil.example/',
			'javascript:alert(1)',
			'/.//evil.example/',
			'/..//evil.example/',
			'/a/..//evil.example/',
			'/%2e//evil.example/',
			'/./\\evil.example/',
			'stamm/materials'
		]) {
			expect(safeRedirectTarget(target), JSON.stringify(target)).toBe('/');
		}
	});

	it('normalizes dot segments', () => {
		expect(safeRedirectTarget('/a/../b')).toBe('/b');
	});
});

describe('loginPath', () => {
	it('comes back to the page', () => {
		expect(loginPath(new URL('http://localhost/stamm/kits?selected=1'))).toBe(
			'/login?redirectTo=%2Fstamm%2Fkits%3Fselected%3D1'
		);
	});
});
