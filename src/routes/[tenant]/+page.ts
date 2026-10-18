import { createTenantApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const api = createTenantApi((await parent()).tenant.id, fetch, url);
	const [materials, items, locations] = await Promise.all([
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		unwrap(api.GET('/locations'))
	]);
	return { materials, items, locations };
};
