// Suggestions for merging materials into variants of one (POST /materials/merge): "Seil 10 m", "Seil 15 m" and
// "Seil 20 m" become "Seil" with the variants "10 m", "15 m" and "20 m".

import type { Material, Variant } from '#lib/api/index.js';

/** Separators left over at the edges when a name is split into a prefix and a remainder, e.g. "Seil - 10 m". */
const EDGE_SEPARATORS = /^[\s,;:/–—-]+|[\s,;:/–—-]+$/g;

function words(name: string): string[] {
	return name.trim().split(/\s+/).filter(Boolean);
}

function sameWord(a: string, b: string): boolean {
	return a.toLocaleLowerCase('de') === b.toLocaleLowerCase('de');
}

/** [words] joined, without separators at the edges and without parentheses around all of it ("(10 L)" → "10 L"). */
function clean(words: string[]): string {
	const text = words.join(' ').replace(EDGE_SEPARATORS, '');
	const enclosed = /^\(([^()]*)\)$/.exec(text);
	return enclosed ? enclosed[1].trim() : text;
}

/**
 * Splits [names] into the words they all start with (ignoring case, spelled as in the first name) and what remains
 * of each: "Seil 10 m", "Seil 15 m" → "Seil" and "10 m", "15 m". Whole words only, so "Seil 10 m" and "Seil 15 m"
 * don't share "Seil 1". Without a common start, the prefix is empty and the remainders are the whole names.
 */
export function splitNames(names: string[]): { prefix: string; remainders: string[] } {
	const split = names.map(words);
	const [first = []] = split;
	let length = first.length;
	for (const other of split.slice(1)) {
		let i = 0;
		while (i < length && i < other.length && sameWord(first[i], other[i])) i++;
		length = i;
	}
	const prefix = clean(first.slice(0, length));
	// A prefix of separators only ("- 10 m", "- 15 m") isn't a name.
	const common = prefix ? length : 0;
	return { prefix, remainders: split.map((name) => clean(name.slice(common))) };
}

type Mergeable = Pick<Material, 'name'> & { variants: readonly Pick<Variant, 'id' | 'name'>[] };

/**
 * What the merge dialog starts with for [materials] (the target first): the common start of their names as the new
 * name (the target's name if there is none), and a name for every variant. A material's only unnamed variant is
 * named after the rest of the material's name ("10 m"); named variants keep their names. A name may come out empty
 * ("Kohtenplane" next to "Kohtenplane 45 cm Latz"); it has to be filled in then.
 */
export function suggestMerge(materials: readonly Mergeable[]): {
	name: string;
	variantNames: Map<string, string>;
} {
	const { prefix, remainders } = splitNames(materials.map((material) => material.name));
	const variantNames = new Map<string, string>();
	materials.forEach((material, m) => {
		for (const variant of material.variants) {
			const unnamedOnly = material.variants.length === 1 && !variant.name;
			variantNames.set(variant.id, unnamedOnly ? remainders[m] : (variant.name ?? ''));
		}
	});
	return { name: prefix || (materials[0]?.name ?? ''), variantNames };
}
