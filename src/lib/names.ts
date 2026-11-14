// Suggestions for usernames and slugs from what people type, matching what the API accepts.

/** Lowercase letters, digits, `.`, `_` and `-`. */
export const USERNAME_PATTERN = '[a-z0-9._\\-]{3,100}';

/** Lowercase letters and digits, with single hyphens in between. */
export const SLUG_PATTERN = '[a-z0-9]+(-[a-z0-9]+)*';

/** Lowercase ASCII, German umlauts spelled out, other accents removed. */
function plain(text: string): string {
	return text
		.trim()
		.toLowerCase()
		.replaceAll('ä', 'ae')
		.replaceAll('ö', 'oe')
		.replaceAll('ü', 'ue')
		.replaceAll('ß', 'ss')
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, ''); // combining accents
}

/** A username for [displayName], e.g. "Max Müller" → "max.mueller". */
export function suggestUsername(displayName: string): string {
	return plain(displayName)
		.replace(/\s+/g, '.')
		.replace(/[^a-z0-9._-]/g, '')
		.slice(0, 100);
}

/** A slug for a tenant called [name], e.g. "Stamm St. Georg" → "stamm-st-georg". */
export function suggestSlug(name: string): string {
	return plain(name)
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 50)
		.replace(/-+$/, '');
}

/** Initials for an avatar, e.g. "Max Müller" → "MM", "Lena" → "LE". */
export function initials(displayName: string): string {
	const words = displayName.trim().split(/\s+/);
	return (words.length > 1 ? words[0][0] + words.at(-1)![0] : words[0].slice(0, 2)).toUpperCase();
}
