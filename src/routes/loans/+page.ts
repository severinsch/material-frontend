import { createApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url }) => {
	const api = createApi(fetch, url.origin);
	const showAll = url.searchParams.has('all');
	const [loans, materials, items] = await Promise.all([
		unwrap(api.GET('/loans', { params: { query: showAll ? {} : { open: true } } })),
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items'))
	]);
	return {
		loans: loans.toSorted((a, b) => b.lentAt.localeCompare(a.lentAt)),
		materials,
		items,
		showAll
	};
};
