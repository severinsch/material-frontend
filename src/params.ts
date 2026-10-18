import { defineParams } from '@sveltejs/kit/params';

/** Top-level pages from before tenants existed; old links to them are redirected into a tenant. */
export const legacyPages = ['materials', 'kits', 'loans', 'locations', 'overview'];

export const params = defineParams({
	legacy: (param) => (legacyPages.includes(param) ? param : undefined)
});
