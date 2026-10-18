import { redirect } from '@sveltejs/kit';
import { defaultTenant } from '#lib/server/tenants.js';
import type { PageServerLoad } from './$types';

/** `?kein-zugriff`: the user just lost access to the tenant they were using (see `[tenant]/+layout.server.ts`). */
export const load: PageServerLoad = ({ locals, cookies, url }) => {
	const lostAccess = url.searchParams.has('kein-zugriff');
	const tenant = lostAccess ? undefined : defaultTenant(locals.user!, cookies);
	if (tenant) redirect(303, `/${tenant.slug}`);
	return { lostAccess };
};
