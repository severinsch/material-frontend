import { createApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const api = createApi(fetch, url.origin);
	const [materials, items, locations] = await Promise.all([
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		unwrap(api.GET('/locations'))
	]);
	return { materials, items, locations };
};
