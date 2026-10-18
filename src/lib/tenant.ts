import { createContext } from 'svelte';
import type { CurrentUser, TenantApi, UserTenant } from '#lib/api/index.js';
import type { Permission } from '#lib/permissions.js';

/** The tenant of the current page, provided by `routes/[tenant]/+layout.svelte` to the components below it. */
export interface TenantContext {
	readonly tenant: UserTenant;
	readonly user: CurrentUser;
	/** A client for the tenant's API routes, for event handlers in the browser. */
	readonly api: TenantApi;
	/** The path of a page of the tenant, e.g. `href('/kits')`. */
	href(path: string): string;
	can(permission: Permission): boolean;
}

export const [getTenant, setTenant] = createContext<TenantContext>();
