import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const { tenant } = await parent();
	const api = createTenantApi(tenant.id, fetch, url);
	const [materials, items, locations, kits] = await Promise.all([
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		unwrap(api.GET('/locations')),
		// Only the merge dialog for editors needs the kits.
		hasPermission(tenant.role, 'EDIT') ? unwrap(api.GET('/kits')) : []
	]);
	return { materials, items, locations, kits };
};
