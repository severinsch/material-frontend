import { createTenantApi, unwrap } from '#lib/api/index.js';
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
		/** Bulk variants stored here, each with its material; variants of one material may be stored elsewhere. */
		bulkVariants: materials.flatMap((material) =>
			material.trackingType === 'BULK'
				? material.variants
						.filter((variant) => variant.location?.id === location.id)
						.map((variant) => ({ material, variant }))
				: []
		),
		items: items.filter((item) => item.storageLocation?.id === location.id)
	};
};
