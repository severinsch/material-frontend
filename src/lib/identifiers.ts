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

/** The identifier after the highest numbered one in [existing], e.g. "K13" after "K01"–"K12"; "1" if there is none. */
export function nextIdentifier(existing: string[]): string {
	let highest: { identifier: string; number: number } | null = null;
	for (const identifier of existing) {
		const match = numbered.exec(identifier);
		if (match && (!highest || Number(match[2]) > highest.number)) {
			highest = { identifier, number: Number(match[2]) };
		}
	}
	return highest ? numberedIdentifiers(highest.identifier, 2)![1] : '1';
}
