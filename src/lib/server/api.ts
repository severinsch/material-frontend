import { error } from '@sveltejs/kit';
import { API_URL } from '$app/env/private';

/** The API's base URL, with a trailing slash so relative paths stay below it. */
export const apiBase = new URL(API_URL.endsWith('/') ? API_URL : `${API_URL}/`);

export interface ApiCall {
	method?: string;
	/** JSON, already serialized. */
	body?: string;
	/** The session token. */
	token?: string;
	/** The browser's IP address, which the API uses to throttle failed logins. */
	clientAddress?: string;
}

/** Headers for a call from this server to the API. */
export function apiHeaders({ token, clientAddress }: ApiCall): Record<string, string> {
	return {
		'content-type': 'application/json',
		accept: 'application/json',
		...(token && { authorization: `Bearer ${token}` }),
		...(clientAddress && { 'x-forwarded-for': clientAddress })
	};
}

/** Calls the API at [path] (relative, e.g. `auth/me`). Fails with 502 if it isn't reachable. */
export async function callApi(path: string, call: ApiCall = {}): Promise<Response> {
	try {
		return await fetch(new URL(path, apiBase), {
			method: call.method ?? 'GET',
			headers: apiHeaders(call),
			body: call.body
		});
	} catch {
		error(502, 'Der Material-Server ist nicht erreichbar.');
	}
}

/** The API's error message of a failed [response]. */
export async function errorMessage(response: Response): Promise<string> {
	const body = await response.json().catch(() => undefined);
	return body?.message ?? 'Die Anfrage ist fehlgeschlagen.';
}
