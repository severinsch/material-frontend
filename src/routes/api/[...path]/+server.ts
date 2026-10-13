import { API_URL } from '$app/env/private';
import type { RequestHandler } from './$types';

const apiBase = new URL(API_URL.endsWith('/') ? API_URL : `${API_URL}/`);

// Forwards /api/* to the backend. The browser only talks to this server, so the API needs neither CORS nor a public
// address, and authentication can later be added here in one place.
export const fallback: RequestHandler = async ({ request, url }) => {
	// Forward the path still percent-encoded, so an encoded `/`, `?` or `#` stays part of a path segment. URL resolves
	// dot segments; anything that would end up outside the API's base path is rejected.
	const target = new URL(url.pathname.slice('/api/'.length) + url.search, apiBase);
	if (target.origin !== apiBase.origin || !target.pathname.startsWith(apiBase.pathname)) {
		return Response.json({ message: 'Invalid API path.' }, { status: 400 });
	}

	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	let response: Response;
	try {
		response = await fetch(target, {
			method: request.method,
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: hasBody ? await request.text() : undefined
		});
	} catch {
		return Response.json({ message: 'The material API is not reachable.' }, { status: 502 });
	}
	const contentType = response.headers.get('content-type');
	return new Response(response.body, {
		status: response.status,
		headers: contentType ? { 'content-type': contentType } : {}
	});
};
