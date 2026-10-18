import type { Cookies } from '@sveltejs/kit';
import type { CurrentUser, UserTenant } from '#lib/api/index.js';

/** The tenant used last, so `/` and old links can go there. Only a convenience. */
const LAST_TENANT_COOKIE = 'tenant';

export function rememberTenant(cookies: Cookies, tenant: UserTenant) {
	cookies.set(LAST_TENANT_COOKIE, tenant.slug, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 365
	});
}

/** Where to go without a tenant in the URL: the only tenant of the user, otherwise the one used last. */
export function defaultTenant(user: CurrentUser, cookies: Cookies): UserTenant | undefined {
	if (user.tenants.length === 1) return user.tenants[0];
	return user.tenants.find((tenant) => tenant.slug === cookies.get(LAST_TENANT_COOKIE));
}
