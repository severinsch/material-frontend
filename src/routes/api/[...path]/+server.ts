import { apiBase, apiHeaders } from '#lib/server/api.js';
import { endSession, sessionToken } from '#lib/server/session.js';
import type { RequestHandler } from './$types';

/**
 * The API routes the browser may use. Login and setup are not among them: they go through form actions, which keep
 * the session token out of page JavaScript (it only lives in an httpOnly cookie).
 */
const allowedPaths = [/^tenants(\/|$)/, /^users(\/|$)/, /^auth\/me(\/password)?$/];

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS']);

// Forwards /api/* to the backend with the session from the cookie. The browser only talks to this server, so the API
// needs neither CORS nor a public address.
export const fallback: RequestHandler = async ({ request, url, cookies, getClientAddress }) => {
	// SvelteKit only checks the origin of form submissions; the API is called with JSON.
	if (!safeMethods.has(request.method) && request.headers.get('origin') !== url.origin) {
		return Response.json({ message: 'Ungültige Herkunft der Anfrage.' }, { status: 403 });
	}

	// Forward the path still percent-encoded, so an encoded `/`, `?` or `#` stays part of a path segment. URL resolves
	// dot segments; anything that would end up outside the API's base path is rejected.
	const target = new URL(url.pathname.slice('/api/'.length) + url.search, apiBase);
	const path = target.pathname.slice(apiBase.pathname.length);
	if (
		target.origin !== apiBase.origin ||
		!target.pathname.startsWith(apiBase.pathname) ||
		!allowedPaths.some((allowed) => allowed.test(path))
	) {
		return Response.json({ message: 'Unbekannter API-Pfad.' }, { status: 404 });
	}

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	let response: Response;
	try {
		response = await fetch(target, {
			method: request.method,
			headers: apiHeaders({ token: sessionToken(cookies), clientAddress: getClientAddress() }),
			body: hasBody ? await request.text() : undefined
		});
	} catch {
		return Response.json({ message: 'Der Material-Server ist nicht erreichbar.' }, { status: 502 });
	}
	// 401 only means "no valid session", so the cookie is useless.
	if (response.status === 401) endSession(cookies);
	const contentType = response.headers.get('content-type');
	return new Response(response.body, {
		status: response.status,
		headers: contentType ? { 'content-type': contentType } : {}
	});
};
