import { API_URL } from '$app/env/private';
import type { RequestHandler } from './$types';

// Forwards /api/* to the backend. The browser only talks to this server, so the API needs neither CORS nor a public
// address, and authentication can later be added here in one place.
export const fallback: RequestHandler = async ({ request, params, url }) => {
	const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
	let response: Response;
	try {
		response = await fetch(`${API_URL}/${params.path}${url.search}`, {
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
