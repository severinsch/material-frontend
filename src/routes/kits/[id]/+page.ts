import { createApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params }) => {
	const api = createApi(fetch, url.origin);
	const [kit, materials] = await Promise.all([
		unwrap(api.GET('/kits/{id}', { params: { path: params } })),
		unwrap(api.GET('/materials'))
	]);
	return { kit, materials };
};
