import { createTenantApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

// Everyone who can see the inventory sees the report: it shows nothing beyond the material pages.
export const load: PageLoad = async ({ fetch, url, parent }) => {
	const api = createTenantApi((await parent()).tenant.id, fetch, url);
	const [materials, items, purchases] = await Promise.all([
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		unwrap(api.GET('/purchases'))
	]);
	return { materials, items, purchases };
};
