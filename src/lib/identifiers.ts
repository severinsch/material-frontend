// Item identifiers like "7", "K01" or "Zelt-12": an optional prefix and a number, whose width is kept when counting
// upwards ("K09" → "K10").

const numbered = /^(.*?)(\d+)$/;

/** [count] identifiers starting at [first], or null if [first] doesn't end with a number. */
export function numberedIdentifiers(first: string, count: number): string[] | null {
	const match = numbered.exec(first.trim());
	if (!match) return null;
	const [, prefix, digits] = match;
	const start = Number(digits);
	return Array.from(
		{ length: count },
		(_, i) => prefix + String(start + i).padStart(digits.length, '0')
	);
}

/**
 * The identifier after the highest numbered one in [existing], e.g. "K13" after "K01"–"K12"; "1" if there is none.
 * Identifiers in [taken] are skipped ("K14" if "K13" is taken).
 */
export function nextIdentifier(existing: string[], taken: string[] = []): string {
	let highest: { prefix: string; digits: string } | null = null;
	for (const identifier of existing) {
		const match = numbered.exec(identifier);
		if (match && (!highest || Number(match[2]) > Number(highest.digits))) {
			highest = { prefix: match[1], digits: match[2] };
		}
	}
	const { prefix, digits } = highest ?? { prefix: '', digits: '0' };
	const used = new Set(taken);
	for (let number = Number(digits) + 1; ; number++) {
		const next = prefix + String(number).padStart(digits.length, '0');
		if (!used.has(next)) return next;
	}
}
