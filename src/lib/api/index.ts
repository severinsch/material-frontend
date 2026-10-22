import createClient, { type Middleware } from 'openapi-fetch';
import { error, isHttpError, redirect } from '@sveltejs/kit';
import { goto, refreshAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import { loginPath } from '#lib/redirect.js';
import type { components, paths } from './schema.js';

// Generated from the backend's openapi.json with `bun run api:generate`.
type Schemas = components['schemas'];
export type Material = Schemas['Material'];
export type BulkMaterial = Schemas['BulkMaterial'];
export type IndividualMaterial = Schemas['IndividualMaterial'];
export type BulkVariant = Schemas['BulkVariant'];
export type IndividualVariant = Schemas['IndividualVariant'];
export type Variant = BulkVariant | IndividualVariant;
export type NewMaterial = Schemas['NewMaterial'];
export type IndividualItem = Schemas['IndividualItem'];
export type NewIndividualItem = Schemas['NewIndividualItem'];
export type ItemCondition = IndividualItem['condition'];
export type ItemStatus = IndividualItem['status'];
export type StorageLocation = Schemas['StorageLocation'];
export type Purchase = Schemas['Purchase'];
export type NewPurchase = Schemas['NewPurchase'];
export type DamageReport = Schemas['DamageReport'];
export type NewDamageReport = Schemas['NewDamageReport'];
export type Kit = Schemas['Kit'];
export type KitGroup = Schemas['KitGroup'];
export type KitGroupAmount = Schemas['KitGroupAmount'];
export type KitGroupOption = Schemas['KitGroupOption'];
export type NewKit = Schemas['NewKit'];
export type Loan = Schemas['Loan'];
export type NewLoan = Schemas['NewLoan'];
export type CurrentUser = Schemas['CurrentUser'];
export type UserTenant = Schemas['UserTenant'];
export type TenantRole = UserTenant['role'];
export type SessionToken = Schemas['SessionToken'];
export type SetupLink = Schemas['SetupLink'];
export type SetupInfo = Schemas['SetupInfo'];
export type Member = Schemas['Member'];
export type Tenant = Schemas['Tenant'];
export type User = Schemas['User'];

type TenantPrefix = '/tenants/{tenantId}';

/** An operation without the `tenantId` path parameter, which a tenant's client fills in. */
type WithoutTenantId<Operation> = Operation extends { parameters: { path: infer Path } }
	? Omit<Operation, 'parameters'> & {
			parameters: Omit<Operation['parameters'], 'path'> &
				(keyof Omit<Path, 'tenantId'> extends never
					? { path?: never }
					: { path: Omit<Path, 'tenantId'> });
		}
	: Operation;

/** The routes of one tenant, without the `/tenants/{tenantId}` prefix (platform routes like `/restore` excluded). */
export type TenantPaths = {
	[
		P in keyof paths as P extends `${TenantPrefix}/restore`
			? never
			: P extends `${TenantPrefix}/${infer Rest}`
				? `/${Rest}`
				: never
	]: { [Method in keyof paths[P]]: WithoutTenantId<paths[P][Method]> };
};

/**
 * In load functions: on 401 (session expired), go to the login page and come back to [url] afterwards. Browser event
 * handlers use [mutate] instead, which keeps the page.
 */
function loginOnUnauthorized(url: URL): Middleware {
	return {
		onResponse({ response }) {
			if (response.status === 401) redirect(303, loginPath(url));
		}
	};
}

/**
 * Every request declares JSON, including bodyless DELETEs: SvelteKit treats requests without a content type like
 * form submissions and applies its form checks to them.
 */
function client<Paths extends object>(baseUrl: string, fetch: typeof globalThis.fetch, url?: URL) {
	const client = createClient<Paths>({
		baseUrl,
		fetch,
		headers: { 'content-type': 'application/json' }
	});
	if (url) client.use(loginOnUnauthorized(url));
	return client;
}

/**
 * A client for the API proxy at `/api`, for routes outside of tenants (account, administration). Load functions pass
 * their `fetch` and `url`, so requests during server-side rendering are handled internally; the defaults suit event
 * handlers in the browser.
 */
export function createApi(fetch = globalThis.fetch, url?: URL) {
	return client<paths>(`${url?.origin ?? ''}/api`, fetch, url);
}

/** Like [createApi], for the routes of one tenant: `api.GET('/materials')`. */
export function createTenantApi(tenantId: string, fetch = globalThis.fetch, url?: URL) {
	return client<TenantPaths>(`${url?.origin ?? ''}/api/tenants/${tenantId}`, fetch, url);
}

export type TenantApi = ReturnType<typeof createTenantApi>;

export const api = createApi();

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/** The response data, or an `HttpError` with the API's error message (rendered by `+error.svelte` in loads). */
export async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
	const { data, error: body, response } = await request;
	if (!response.ok) {
		const message = (body as { message?: string } | undefined)?.message;
		error(response.status, message ?? 'Die Anfrage ist fehlgeschlagen.');
	}
	return data as T;
}

export interface MutateOptions<T> {
	/** Navigates there afterwards instead of reloading the page data, e.g. to the page of a created material. */
	redirectTo?: string | ((data: T) => string);
	/** Offers an "Undo" action in the success toast that runs this request. */
	undo?: () => Promise<ApiResult<unknown>>;
	/** Runs with the response data before the page data is reloaded, e.g. to show a created setup link. */
	onSuccess?: (data: T) => void;
}

/**
 * Runs a change, reports the outcome as a toast and reloads the page data (or navigates, see [MutateOptions]).
 * Returns whether it succeeded. If the session expired, the page stays as it is (e.g. with an open dialog) and the
 * toast offers to log in again in a new tab.
 */
export async function mutate<T>(
	request: Promise<ApiResult<T>>,
	success: string,
	{ redirectTo, undo, onSuccess }: MutateOptions<T> = {}
): Promise<boolean> {
	let data: T;
	try {
		data = await unwrap(request);
	} catch (e) {
		if (isHttpError(e) && e.status === 401) {
			toast.error('Deine Sitzung ist abgelaufen.', {
				description: 'Melde dich in einem neuen Tab an und versuch es dann noch einmal.',
				duration: Infinity,
				action: { label: 'Anmelden', onClick: () => window.open(loginPath(), '_blank') }
			});
		} else {
			toast.error(isHttpError(e) ? e.body.message : 'Die Anfrage ist fehlgeschlagen.');
		}
		return false;
	}
	toast.success(success, {
		action: undo && {
			label: 'Rückgängig',
			onClick: () => void mutate(undo(), 'Rückgängig gemacht')
		}
	});
	onSuccess?.(data);
	await (redirectTo
		? goto(typeof redirectTo === 'string' ? redirectTo : redirectTo(data))
		: refreshAll());
	return true;
}
