import { createTenantApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const locations = await unwrap(
		createTenantApi((await parent()).tenant.id, fetch, url).GET('/locations')
	);
	return { locations };
};
