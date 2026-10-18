import { error } from '@sveltejs/kit';
import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const { tenant } = await parent();
	if (!hasPermission(tenant.role, 'EDIT')) error(403, 'Dafür fehlt dir die Berechtigung.');
	const materials = await unwrap(createTenantApi(tenant.id, fetch, url).GET('/materials'));
	return { materials };
};
