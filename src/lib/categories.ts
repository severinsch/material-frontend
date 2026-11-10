// Categories are free text on the materials, without a lookup table. The API trims them and otherwise stores them as
// typed, so "Zelte" and "zelte" are two categories; suggesting existing ones avoids such splits.

/** A category in use, with the number of materials in it. */
export interface CategoryUse {
	name: string;
	count: number;
}

const keyOf = (category: string) => category.trim().toLowerCase();

/** The categories of [materials] as the API stores them (trimmed), most used first. */
export function categoriesOf(materials: readonly { category?: string | null }[]): CategoryUse[] {
	const counts = new Map<string, number>();
	for (const material of materials) {
		const name = material.category?.trim();
		if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
	}
	return [...counts]
		.map(([name, count]) => ({ name, count }))
		.toSorted((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Categories to suggest for the typed [input]: without input the most used ones; otherwise those containing it
 * (ignoring case), the ones starting with it first. Nothing while [input] already is a category in its spelling.
 */
export function suggestCategories(
	categories: readonly CategoryUse[],
	input: string,
	limit = 6
): string[] {
	const typed = keyOf(input);
	if (categories.some((category) => category.name === input.trim() && typed)) return [];
	const matching = typed
		? categories
				.filter((category) => category.name.toLowerCase().includes(typed))
				.toSorted(
					(a, b) =>
						Number(!a.name.toLowerCase().startsWith(typed)) -
						Number(!b.name.toLowerCase().startsWith(typed))
				)
		: categories;
	return matching.slice(0, limit).map((category) => category.name);
}
