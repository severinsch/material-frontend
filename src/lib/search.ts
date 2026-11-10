// Text search in lists: case-insensitive substring matching, shared by the material list and the loan dialog.

/** [query] as it is matched: trimmed and in lower case. An empty search matches everything. */
export function normalizeSearch(query: string): string {
	return query.trim().toLowerCase();
}

/** Whether [text] contains [search] (see [normalizeSearch]), ignoring case. */
export function matchesText(text: string | null | undefined, search: string): boolean {
	return text != null && text.toLowerCase().includes(search);
}

/** Numbers without leading zeros: "k07" → "k7". */
const withoutLeadingZeros = (text: string) => text.replace(/(^|\D)0+(?=\d)/g, '$1');

/**
 * Whether the item [identifier] matches [search] (see [normalizeSearch]): it contains it, or it is the same apart from
 * leading zeros, since labels painted on a tent ("K7") don't always match the identifier ("K07"). An empty search
 * matches no identifier, so the identifiers don't count as hits while nothing is searched.
 */
export function matchesIdentifier(identifier: string, search: string): boolean {
	if (!search) return false;
	const lower = identifier.toLowerCase();
	return lower.includes(search) || withoutLeadingZeros(lower) === withoutLeadingZeros(search);
}

/** How a material matches a search. */
export interface MaterialMatch {
	/** Whether the material is listed: its own texts or one of its items match. */
	matches: boolean;
	/** Whether the material's own texts match (its name, category, …), not just item identifiers. */
	byText: boolean;
	/** The ids of the items whose identifier matches. */
	itemIds: Set<string>;
}

/**
 * How a material with the searchable [texts] (name, category, variant names, …) and [items] matches [search] (see
 * [normalizeSearch]).
 */
export function matchMaterial(
	search: string,
	texts: readonly (string | null | undefined)[],
	items: readonly { id: string; identifier: string }[]
): MaterialMatch {
	const byText = texts.some((text) => matchesText(text, search));
	const itemIds = new Set(
		items.filter((item) => matchesIdentifier(item.identifier, search)).map((item) => item.id)
	);
	return { matches: byText || itemIds.size > 0, byText, itemIds };
}
