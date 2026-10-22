// Suggestions for merging materials into variants of one (POST /materials/merge): "Seil 10 m", "Seil 15 m" and
// "Seil 20 m" become "Seil" with the variants "10 m", "15 m" and "20 m".

import type { Kit, Material, Variant } from '#lib/api/index.js';

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

/** E.g. "im Set Jurte" or "in den Sets Jurte, Kohte", as in the API's messages. */
function inKits(names: string[]): string {
	return names.length === 1 ? `im Set ${names[0]}` : `in den Sets ${names.join(', ')}`;
}

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });

/**
 * What happens to the [kits] that use any of [materials] (the target first), by kit name, sorted. Most keep using the
 * same variants ([same]), since the API turns "any variant" of a material with a single variant into that variant.
 * "Any variant" of a target that already has several stays, and then includes the variants it gains ([widened]).
 *
 * The API rejects the merge in two cases, which [blocked] explains with its messages, one per material: a source with
 * several variants used with "any variant", which can't be expressed afterwards, and "any variant" of a target with
 * several variants in a group that also lists a source, which would overlap afterwards.
 */
export function kitsAfterMerge(
	kits: readonly Pick<Kit, 'name' | 'groups'>[],
	materials: readonly (Pick<Material, 'id' | 'name'> & { variants: readonly unknown[] })[]
): { same: string[]; widened: string[]; blocked: string[] } {
	const [target, ...sources] = materials;
	if (!target) return { same: [], widened: [], blocked: [] };
	const ids = new Set(materials.map((material) => material.id));
	const sourceIds = new Set(sources.map((material) => material.id));
	const several = (material: { variants: readonly unknown[] }) => material.variants.length > 1;
	/** Kits that make the merge fail, by the material they use with "any variant". */
	const anySource = new Map(
		sources.filter(several).map((source) => [source.id, new Set<string>()])
	);
	const overlapping = new Set<string>();
	const same: string[] = [];
	const widened: string[] = [];
	for (const kit of kits) {
		let blocked = false;
		for (const { options } of kit.groups) {
			const anyOf = (id: string) => options.some((o) => o.materialId === id && !o.variantId);
			for (const [id, kitNames] of anySource) {
				if (anyOf(id)) {
					kitNames.add(kit.name);
					blocked = true;
				}
			}
			if (several(target) && anyOf(target.id) && options.some((o) => sourceIds.has(o.materialId))) {
				overlapping.add(kit.name);
				blocked = true;
			}
		}
		if (blocked) continue;
		const options = kit.groups.flatMap((group) => group.options);
		if (several(target) && options.some((o) => o.materialId === target.id && !o.variantId)) {
			widened.push(kit.name);
		} else if (options.some((option) => ids.has(option.materialId))) {
			same.push(kit.name);
		}
	}

	const blocked: string[] = [];
	for (const source of sources) {
		const kitNames = [...(anySource.get(source.id) ?? [])].sort(byName);
		if (kitNames.length === 0) continue;
		blocked.push(
			`${source.name} wird ${inKits(kitNames)} mit beliebiger Variante verwendet, was sich nach dem ` +
				'Zusammenführen nicht mehr ausdrücken lässt. Wähle dort zuerst bestimmte Varianten aus, oder führe ' +
				'die anderen Materialien in dieses zusammen.'
		);
	}
	if (overlapping.size > 0) {
		blocked.push(
			`${target.name} wird ${inKits([...overlapping].sort(byName))} mit beliebiger Variante verwendet, ` +
				'zusammen mit einem der anderen Materialien im selben Teil. Danach würden sich die Materialien des ' +
				'Teils überschneiden. Entferne zuerst eines davon aus dem Teil.'
		);
	}
	return { same: same.sort(byName), widened: widened.sort(byName), blocked };
}
