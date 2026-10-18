import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const { tenant } = await parent();
	const api = createTenantApi(tenant.id, fetch, url);
	const showAll = url.searchParams.has('all');
	const [loans, materials, items, members] = await Promise.all([
		unwrap(api.GET('/loans', { params: { query: showAll ? {} : { open: true } } })),
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		// Borrowers editors can choose from; everyone else only borrows for themselves.
		hasPermission(tenant.role, 'EDIT') ? unwrap(api.GET('/members')) : []
	]);
	return {
		loans: loans.toSorted((a, b) => b.lentAt.localeCompare(a.lentAt)),
		materials,
		items,
		members,
		showAll
	};
};
