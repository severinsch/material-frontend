import { error } from '@sveltejs/kit';
import { createApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const { user } = await parent();
	if (!user?.isPlatformAdmin) error(403, 'Das dürfen nur Plattform-Admins.');
	const api = createApi(fetch, url);
	const [tenants, users] = await Promise.all([
		unwrap(api.GET('/tenants')),
		unwrap(api.GET('/users'))
	]);
	return { tenants, users };
};
