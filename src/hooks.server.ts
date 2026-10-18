import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import type { CurrentUser } from '#lib/api/index.js';
import { loginPath } from '#lib/redirect.js';
import { callApi } from '#lib/server/api.js';
import { endSession, sessionToken } from '#lib/server/session.js';

/** Pages that work without a session. */
const publicPaths = ['/login', '/setup'];

/**
 * Loads the user for every page request and sends visitors without a session to the login page. In the hook rather
 * than a layout load, so it also covers child loads running in parallel and future `+server.ts` routes. The API proxy
 * (`/api`) is left out: the API checks the session itself.
 */
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;
	event.locals.user = null;
	if (!pathname.startsWith('/api/')) {
		event.locals.user = await currentUser(event);
		const isPublic = publicPaths.some(
			(path) => pathname === path || pathname.startsWith(`${path}/`)
		);
		if (!event.locals.user && !isPublic) redirect(303, loginPath(event.url));
	}

	const response = await resolve(event);
	// Admin pages must not be framed by other sites (clickjacking); links to other sites don't reveal paths.
	response.headers.set('content-security-policy', "frame-ancestors 'none'");
	response.headers.set('referrer-policy', 'same-origin');
	return response;
};

async function currentUser({ cookies }: RequestEvent): Promise<CurrentUser | null> {
	const token = sessionToken(cookies);
	if (!token) return null;
	const response = await callApi('auth/me', { token });
	if (response.status === 401) {
		endSession(cookies);
		return null;
	}
	if (!response.ok) error(502, 'Der Material-Server antwortet nicht wie erwartet.');
	return response.json();
}
