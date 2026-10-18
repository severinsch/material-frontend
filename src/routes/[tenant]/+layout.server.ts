import { redirect } from '@sveltejs/kit';
import { rememberTenant } from '#lib/server/tenants.js';
import type { LayoutServerLoad } from './$types';

/** Reruns with the root layout, i.e. on every navigation, so someone who lost access is sent to `/` right away. */
export const load: LayoutServerLoad = async ({ parent, params, cookies }) => {
	const { user } = await parent();
	const tenant = user!.tenants.find((tenant) => tenant.slug === params.tenant);
	// Unknown, deleted, renamed, or no (longer) access: `/` explains and lists the user's tenants.
	if (!tenant) redirect(303, '/?kein-zugriff');
	rememberTenant(cookies, tenant);
	return { tenant };
};
