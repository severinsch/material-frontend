import { readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { legacyPages } from './params.js';

/** Copy of `NewTenant.RESERVED_SLUGS` in the API: top-level paths that can't be the slug of a tenant. */
const reservedSlugs = [
	'login',
	'logout',
	'setup',
	'account',
	'admin',
	'api',
	'materials',
	'kits',
	'loans',
	'locations',
	'overview'
];

it('reserves every top-level route as tenant slug in the API', () => {
	const topLevelRoutes = readdirSync(new URL('./routes', import.meta.url), { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && !entry.name.startsWith('['))
		.map((entry) => entry.name);
	expect(new Set([...topLevelRoutes, ...legacyPages])).toEqual(new Set(reservedSlugs));
});
