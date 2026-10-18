import { error } from '@sveltejs/kit';
import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params, parent }) => {
	const { tenant } = await parent();
	if (!hasPermission(tenant.role, 'EDIT')) error(403, 'Dafür fehlt dir die Berechtigung.');
	const api = createTenantApi(tenant.id, fetch, url);
	const [kit, materials] = await Promise.all([
		unwrap(api.GET('/kits/{id}', { params: { path: { id: params.id } } })),
		unwrap(api.GET('/materials'))
	]);
	return { kit, materials };
};
