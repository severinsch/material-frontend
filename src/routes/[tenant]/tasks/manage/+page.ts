import { error } from '@sveltejs/kit';
import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const { tenant } = await parent();
	if (!hasPermission(tenant.role, 'EDIT')) error(403, 'Dafür fehlt dir die Berechtigung.');
	const api = createTenantApi(tenant.id, fetch, url);
	const [tasks, rules, routines, materials, items, members] = await Promise.all([
		unwrap(api.GET('/tasks')),
		unwrap(api.GET('/task-rules')),
		unwrap(api.GET('/task-routines')),
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		unwrap(api.GET('/members'))
	]);
	return { tasks, rules, routines, materials, items, members };
};
