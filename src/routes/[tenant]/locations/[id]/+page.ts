import { createTenantApi, unwrap, type BulkMaterial } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params, parent }) => {
	const api = createTenantApi((await parent()).tenant.id, fetch, url);
	const [location, materials, items] = await Promise.all([
		unwrap(api.GET('/locations/{id}', { params: { path: { id: params.id } } })),
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items'))
	]);
	return {
		location,
		/** All materials, for the names of the items. */
		materials,
		bulkMaterials: materials.filter(
			(m): m is BulkMaterial => m.trackingType === 'BULK' && m.location?.id === location.id
		),
		items: items.filter((item) => item.storageLocation?.id === location.id)
	};
};
