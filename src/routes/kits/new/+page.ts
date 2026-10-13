import { createApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const materials = await unwrap(createApi(fetch, url.origin).GET('/materials'));
	return { materials };
};
