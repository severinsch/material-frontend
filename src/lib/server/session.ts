import type { Cookies } from '@sveltejs/kit';
import type { SessionToken } from '#lib/api/index.js';

/**
 * The session token lives in an httpOnly cookie, so page JavaScript never sees it; the API proxy and server code
 * forward it as `Authorization: Bearer`. `secure` is SvelteKit's default except on localhost.
 */
const SESSION_COOKIE = 'session';

export function sessionToken(cookies: Cookies): string | undefined {
	return cookies.get(SESSION_COOKIE);
}

export function startSession(cookies: Cookies, session: SessionToken) {
	cookies.set(SESSION_COOKIE, session.token, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		expires: new Date(session.expiresAt)
	});
}

export function endSession(cookies: Cookies) {
	cookies.delete(SESSION_COOKIE, { path: '/' });
}
