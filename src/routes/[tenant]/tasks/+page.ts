import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const { tenant } = await parent();
	const api = createTenantApi(tenant.id, fetch, url);
	const [tasks, materials, items, members] = await Promise.all([
		unwrap(api.GET('/tasks')),
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		// Only editors assign tasks.
		hasPermission(tenant.role, 'EDIT') ? unwrap(api.GET('/members')) : []
	]);
	return { tasks, materials, items, members };
};
