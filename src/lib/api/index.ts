import createClient from 'openapi-fetch';
import { error, isHttpError } from '@sveltejs/kit';
import { goto, refreshAll } from '$app/navigation';
import { toast } from 'svelte-sonner';
import type { components, paths } from './schema.js';

// Generated from the backend's openapi.json with `bun run api:generate`.
type Schemas = components['schemas'];
export type Material = Schemas['Material'];
export type BulkMaterial = Schemas['BulkMaterial'];
export type NewMaterial = Schemas['NewMaterial'];
export type IndividualItem = Schemas['IndividualItem'];
export type NewIndividualItem = Schemas['NewIndividualItem'];
export type ItemCondition = IndividualItem['condition'];
export type ItemStatus = IndividualItem['status'];
export type StorageLocation = Schemas['StorageLocation'];
export type Purchase = Schemas['Purchase'];
export type DamageReport = Schemas['DamageReport'];
export type Kit = Schemas['Kit'];
export type KitGroup = Schemas['KitGroup'];
export type NewKit = Schemas['NewKit'];
export type Loan = Schemas['Loan'];
export type NewLoan = Schemas['NewLoan'];

/**
 * A client for the API proxy at `/api`. Load functions pass their `fetch` and `url.origin`, so requests during
 * server-side rendering are handled internally; the default suits event handlers in the browser.
 *
 * Every request declares JSON, including bodyless DELETEs: SvelteKit treats requests without a content type like
 * form submissions and rejects them unless their origin matches, which breaks plain-HTTP deployments.
 */
export function createApi(fetch = globalThis.fetch, origin = '') {
	return createClient<paths>({
		baseUrl: `${origin}/api`,
		fetch,
		headers: { 'content-type': 'application/json' }
	});
}

export const api = createApi();

type ApiResult<T> = { data?: T; error?: unknown; response: Response };

/** The response data, or an `HttpError` with the API's error message (rendered by `+error.svelte` in loads). */
export async function unwrap<T>(request: Promise<ApiResult<T>>): Promise<T> {
	const { data, error: body, response } = await request;
	if (!response.ok) {
		const message = (body as { message?: string } | undefined)?.message;
		error(response.status, message ?? response.statusText);
	}
	return data as T;
}

/**
 * Runs a change, reports the outcome as a toast and reloads the page data, or navigates to [redirectTo].
 * Returns whether it succeeded.
 */
export async function mutate(
	request: Promise<ApiResult<unknown>>,
	success: string,
	redirectTo?: string
): Promise<boolean> {
	try {
		await unwrap(request);
	} catch (e) {
		toast.error(isHttpError(e) ? e.body.message : 'The request failed.');
		return false;
	}
	toast.success(success);
	await (redirectTo ? goto(redirectTo) : refreshAll());
	return true;
}
