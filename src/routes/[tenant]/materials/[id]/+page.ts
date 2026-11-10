import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params, parent }) => {
	const { tenant } = await parent();
	const api = createTenantApi(tenant.id, fetch, url);
	const byMaterial = { params: { query: { materialId: params.id } } };
	const [material, locations, items, purchases, damages, materials] = await Promise.all([
		unwrap(api.GET('/materials/{id}', { params: { path: { id: params.id } } })),
		unwrap(api.GET('/locations')),
		unwrap(api.GET('/items', byMaterial)),
		unwrap(api.GET('/purchases', byMaterial)),
		unwrap(api.GET('/damages')),
		// Only the material dialog for editors needs the others, for their categories.
		hasPermission(tenant.role, 'EDIT') ? unwrap(api.GET('/materials')) : []
	]);
	const itemIds = new Set(items.map((item) => item.id));
	return {
		material,
		locations,
		items,
		purchases,
		materials,
		damages: damages.filter((d) => itemIds.has(d.itemId))
	};
};
