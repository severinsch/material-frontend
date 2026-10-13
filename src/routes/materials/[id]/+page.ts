import { createApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = createApi(fetch, url.origin);
	const byMaterial = { params: { query: { materialId: params.id } } };
	const [material, locations, items, purchases, damages] = await Promise.all([
		unwrap(api.GET('/materials/{id}', { params: { path: params } })),
		unwrap(api.GET('/locations')),
		unwrap(api.GET('/items', byMaterial)),
		unwrap(api.GET('/purchases', byMaterial)),
		unwrap(api.GET('/damages'))
	]);
	const itemIds = new Set(items.map((item) => item.id));
	return {
		material,
		locations,
		items,
		purchases,
		damages: damages.filter((d) => itemIds.has(d.itemId))
	};
};
