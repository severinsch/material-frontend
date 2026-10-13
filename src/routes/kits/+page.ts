import { createApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const api = createApi(fetch, url.origin);
	const [kits, materials] = await Promise.all([
		unwrap(api.GET('/kits')),
		unwrap(api.GET('/materials'))
	]);
	return { kits, materials };
};
