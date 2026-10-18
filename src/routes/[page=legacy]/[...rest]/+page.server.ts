import { redirect } from '@sveltejs/kit';
import { defaultTenant } from '#lib/server/tenants.js';
import type { PageServerLoad } from './$types';

/** Old links (`/materials/…`, `/kits`, …) go to the same page in the user's only or last used tenant. */
export const load: PageServerLoad = ({ locals, cookies, params, url }) => {
	const tenant = defaultTenant(locals.user!, cookies);
	if (!tenant) redirect(303, '/');
	const rest = params.rest ? `/${params.rest}` : '';
	redirect(303, `/${tenant.slug}/${params.page}${rest}${url.search}`);
};
