import { error, redirect } from '@sveltejs/kit';
import { lastTenantSlug, rememberTenant } from '#lib/server/tenants.js';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, params, cookies, url }) => {
	// Reading the path makes this rerun on every navigation, with the user just loaded by the hook. So changes by an
	// admin take effect without reloading the page, e.g. someone removed from the tenant is sent to `/`.
	void url.pathname;
	const user = locals.user!;
	const tenant = user.tenants.find((tenant) => tenant.slug === params.tenant);
	if (!tenant) {
		if (lastTenantSlug(cookies) === params.tenant) redirect(303, '/?kein-zugriff');
		error(404, 'Diesen Stamm gibt es nicht, oder du hast keinen Zugriff darauf.');
	}
	rememberTenant(cookies, tenant);
	return { user, tenant };
};
