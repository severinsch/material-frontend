/** The login page, coming back to [url] afterwards (by default the current page, in the browser). */
export function loginPath(url: URL = new URL(location.href)): string {
	return `/login?redirectTo=${encodeURIComponent(url.pathname + url.search)}`;
}

/**
 * Where to go after logging in: [target] if it is a path on this site, otherwise `/`. Rejects everything that could
 * lead elsewhere, like `//host`, `/\host` or absolute URLs, since the parameter comes from a link anyone can craft.
 */
export function safeRedirectTarget(target: string | null): string {
	if (!target?.startsWith('/')) return '/';
	// URL parsing ignores tabs and newlines, treats backslashes like slashes and resolves dot segments, so check the
	// result: `/.//host` becomes `//host`, which browsers read as another site.
	const base = 'http://redirect.invalid';
	const url = new URL(target, base);
	const path = url.pathname + url.search + url.hash;
	return url.origin === base && !path.startsWith('//') ? path : '/';
}
