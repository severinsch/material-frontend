import { createApi, unwrap, type BulkMaterial } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = createApi(fetch, url.origin);
	const [location, materials, items] = await Promise.all([
		unwrap(api.GET('/locations/{id}', { params: { path: params } })),
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
