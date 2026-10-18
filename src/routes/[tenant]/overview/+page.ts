import { createTenantApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const api = createTenantApi((await parent()).tenant.id, fetch, url);
	const [loans, materials, items, damages] = await Promise.all([
		unwrap(api.GET('/loans', { params: { query: { open: true } } })),
		unwrap(api.GET('/materials')),
		unwrap(api.GET('/items')),
		unwrap(api.GET('/damages'))
	]);
	return {
		// Earliest due date first, loans without one last.
		loans: loans.toSorted((a, b) => (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')),
		materials,
		items,
		openDamages: damages.filter((report) => report.resolvedAt == null)
	};
};
