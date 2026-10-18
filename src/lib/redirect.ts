/** The login page, coming back to [url] afterwards (by default the current page, in the browser). */
export function loginPath(url: URL = new URL(location.href)): string {
	return `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`;
}

/**
 * Where to go after logging in: [target] if it is a path on this site, otherwise `/`. Rejects everything that could
 * lead elsewhere, like `//host`, `/\host` or absolute URLs, since the parameter comes from a link anyone can craft.
 */
export function safeRedirectTarget(target: string | null): string {
	if (!target?.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) return '/';
	// URL parsing ignores tabs and newlines and treats backslashes like slashes, so check where it really leads.
	const base = 'http://redirect.invalid';
	const url = new URL(target, base);
	return url.origin === base ? url.pathname + url.search + url.hash : '/';
}
