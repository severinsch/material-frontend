// Schnellerfassung (quick entry): reading the input line, lists of item labels, matching names against the existing
// materials, and what saving an entry would do. The client decides whether an entry adds to an existing variant and
// tells the API which one; the API matches no names.

import type { IndividualItem, Material, Variant } from '#lib/api/index.js';
import { variantName } from '#lib/format.js';
import { nextIdentifier, numberedIdentifiers } from '#lib/identifiers.js';

/** The most items one entry can create (the API's batch limit). */
export const MAX_ITEMS = 100;
/** The largest count of one bulk entry. */
export const MAX_COUNT = 9999;

const numbered = /^(.*?)(\d+)$/;
/** "K13-K15" or "K13-15": a range whose labels start with letters, which can't be a size or a decimal. */
const letterRange = /^[^\s,\d]+\d+\s*[-–]\s*[^\s,\d]*\d+$/;

// --- Lists of item labels ------------------------------------------------------------------------------------------

/**
 * "1-5, 7, 9-10", "K01-K05, K07" (also "K01-05"), "K45 01-K45 03" or "1-10, Rot" as a list of labels, separated by
 * commas; null if a range can't be read ("K12-K10"). Ranges keep the digit width of their first label.
 */
export function parseList(text: string): string[] | null {
	const parts = text
		.replace(/\s*[-–]\s*/g, '-')
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length === 0) return null;
	const result: string[] = [];
	for (const part of parts) {
		const range = /^(.*?\d+)-(.*?\d+)$/.exec(part);
		if (range) {
			const from = numbered.exec(range[1])!;
			const to = numbered.exec(range[2])!;
			const count = Number(to[2]) - Number(from[2]) + 1;
			if (count < 1 || count > MAX_ITEMS) return null;
			result.push(...numberedIdentifiers(range[1], count)!);
		} else if (/[-–]/.test(part) && /\d/.test(part)) {
			return null;
		} else {
			result.push(part);
		}
	}
	return result;
}

/**
 * The reverse of [parseList], for display: runs where counting up gives the next label become ranges ("1–12",
 * "K08–K12", "9–11"); two in a row stay single ("7, 8").
 */
export function compactList(labels: readonly string[], dash = '–'): string {
	const runs: string[][] = [];
	for (const label of labels) {
		const run = runs.at(-1);
		if (run && numberedIdentifiers(run.at(-1)!, 2)?.[1] === label) run.push(label);
		else runs.push([label]);
	}
	return runs
		.map((run) => (run.length > 2 ? `${run[0]}${dash}${run.at(-1)}` : run.join(', ')))
		.join(', ');
}

/** [count] labels from [start], or after the highest of [taken]; null if [start] doesn't end with a number. */
export function autoIdentifiers(
	taken: readonly string[],
	start: string | null,
	count: number
): string[] | null {
	if (count < 1) return [];
	return numberedIdentifiers(start || nextIdentifier([...taken]), count);
}

// --- The input line ------------------------------------------------------------------------------------------------

export interface ParsedLine {
	name: string;
	/** Where the name sits in the line, to replace it with a suggestion. */
	nameStart: number;
	nameEnd: number;
	/** Null without a name. */
	count: number | null;
	/** Labels given in the line; null to number automatically. */
	identifiers: string[] | null;
	/** "ab K01": number automatically from there. */
	start: string | null;
	/** The line itself says individual ("einzeln", a list, "ab …"), whatever the toggle says. */
	individual: boolean;
	/** Why the line can't be used as it is. */
	problem: string | null;
}

/**
 * Reads one line, from the outside in:
 *
 * 1. A number at the start followed by a space is the count: "40 Heringe", "40x Heringe", "40 Stk. Heringe".
 * 2. "einzeln" or "nummeriert" as the last word: individual items, numbered automatically.
 * 3. Before that, at the end, a list of labels if it's marked as one: it starts with "#" or "Nr." ("#7",
 *    "#1-5, 7-9", "#1-10, Rot"), or it is a range of labels with letters ("K13-K15", "K13-15"). Plain numbers
 *    stay in the name, so decimals and sizes are safe ("Spanngurt 2,5", "Isomatte 180-200", "Seil 15 m"). A marked
 *    list that can't be read ("#K12-K10") is a problem, not part of the name.
 * 4. Or "ab K01" at the end: individual, numbered from there.
 * 5. The rest is the name; without a count it's 1.
 */
export function parseLine(line: string): ParsedLine {
	let start = line.length - line.trimStart().length;
	let end = line.trimEnd().length;
	const parsed: ParsedLine = {
		name: '',
		nameStart: start,
		nameEnd: end,
		count: null,
		identifiers: null,
		start: null,
		individual: false,
		problem: null
	};

	const count = /^(\d+)\s*(?:x|×|stk\.?|stück)?\s+(?=\S)/i.exec(line.slice(start, end));
	if (count) {
		parsed.count = Number(count[1]);
		start += count[0].length;
	}

	const keyword = /\s+(?:einzeln|nummeriert)$/i.exec(line.slice(start, end));
	if (keyword) {
		parsed.individual = true;
		end -= keyword[0].length;
	}

	const item = String.raw`[^\s,#]+(?:\s*[-–]\s*[^\s,]*\d+)?`;
	const list = new RegExp(String.raw`\s+(nr\.?\s*|#\s*)?(${item}(?:\s*,\s*${item})*)$`, 'i').exec(
		line.slice(start, end)
	);
	const marked = !!list && (!!list[1] || letterRange.test(list[2]));
	const from = /\s+ab\s+([^\s,]*\d+)$/i.exec(line.slice(start, end));
	if (list && marked) {
		parsed.individual = true;
		end -= list[0].length;
		const identifiers = parseList(list[2]);
		if (!identifiers) {
			parsed.problem = `Die Nummern „${list[2].trim()}“ sind nicht lesbar.`;
		} else {
			if (parsed.count !== null && parsed.count !== identifiers.length) {
				parsed.problem = `${parsed.count} angegeben, aber ${identifiers.length} Nummern.`;
			}
			parsed.identifiers = identifiers;
			parsed.count = identifiers.length;
		}
	} else if (from) {
		parsed.start = from[1];
		parsed.individual = true;
		end -= from[0].length;
	}

	parsed.name = line.slice(start, end).trim();
	parsed.nameStart = start;
	parsed.nameEnd = end;
	if (!parsed.name) parsed.count = null;
	else parsed.count ??= 1;
	return parsed;
}

// --- Matching names ------------------------------------------------------------------------------------------------

export type Match<M extends Material = Material> =
	| { kind: 'existing'; material: M; variant: M['variants'][number] }
	| { kind: 'new' }
	/** The bare name of a material whose variants have names: which one? */
	| { kind: 'variants'; material: M }
	| { kind: 'archived'; material: M }
	/** Names that differ only in case. */
	| { kind: 'ambiguous' };

const key = (name: string) => name.trim().toLocaleLowerCase('de');

/**
 * What an entry named [name] adds to: the variant whose display name ("Heringe", "Seil 15 m") matches,
 * case-insensitively.
 */
export function matchMaterial<M extends Material>(materials: readonly M[], name: string): Match<M> {
	const wanted = key(name);
	const hits = materials.flatMap((material) =>
		(material.variants as Variant[])
			.filter((variant) => key(variantName(material, variant)) === wanted)
			.map((variant) => ({ material, variant }))
	);
	if (hits.length > 1) return { kind: 'ambiguous' };
	if (hits.length === 1) {
		const [{ material, variant }] = hits;
		return material.archivedAt
			? { kind: 'archived', material }
			: { kind: 'existing', material, variant };
	}
	// "Seil" when there are only "Seil 10 m" and "Seil 15 m" (or just "Seil 15 m").
	const bare = materials.find((m) => key(m.name) === wanted);
	if (!bare) return { kind: 'new' };
	return bare.archivedAt
		? { kind: 'archived', material: bare }
		: { kind: 'variants', material: bare };
}

/**
 * "40 Heringe" when [name] is new but reads like an existing material with the count typed at the end ("Heringe 40"),
 * since the smart line only reads a count at the start. Only a hint: "Kanister 10" may well be a new material.
 */
export function countAtEnd(materials: readonly Material[], name: string): string | null {
	const found = /^(.*\S)\s+(\d+)$/.exec(name.trim());
	if (!found || matchMaterial(materials, name).kind !== 'new') return null;
	return matchMaterial(materials, found[1]).kind === 'existing' ? `${found[2]} ${found[1]}` : null;
}

export interface Suggestion<M extends Material = Material> {
	label: string;
	material: M;
	variant: M['variants'][number];
}

/** Variants whose display name contains [name] (from two letters on), not the exact match; archived left out. */
export function similarMaterials<M extends Material>(
	materials: readonly M[],
	name: string,
	limit = 5
): Suggestion<M>[] {
	const wanted = key(name);
	if (wanted.length < 2) return [];
	const result: Suggestion<M>[] = [];
	for (const material of materials) {
		if (material.archivedAt) continue;
		for (const variant of material.variants as Variant[]) {
			const label = variantName(material, variant);
			if (key(label) !== wanted && key(label).includes(wanted)) {
				result.push({ label, material, variant: variant as M['variants'][number] });
			}
		}
	}
	return result.slice(0, limit);
}

// --- What saving would do --------------------------------------------------------------------------------------------

export type Kind = Material['trackingType'];

/** One row as entered, however it was entered (line, fields, steps). */
export interface Draft {
	name: string;
	count: number | null;
	/** The toggle; an existing material's own type wins. */
	kind: Kind;
	/** Labels of new items; null numbers them automatically. */
	identifiers: string[] | null;
	/** First label when numbering automatically ("ab K01"). */
	start: string | null;
	category: string;
}

/** What saving a [Draft] would do. */
export interface Plan {
	match: Match;
	kind: Kind;
	count: number;
	identifiers: string[];
	/** The labels the matched variant has already. */
	taken: string[];
	/** Why it can't be saved: '' when it's just incomplete, null when it can. */
	problem: string | null;
}

export function emptyDraft(category = ''): Draft {
	return { name: '', count: null, kind: 'BULK', identifiers: null, start: null, category };
}

/** What saving [draft] would do, given the existing [materials] and [items]. */
export function planEntry(
	materials: readonly Material[],
	items: readonly Pick<IndividualItem, 'variantId' | 'identifier'>[],
	draft: Draft
): Plan {
	const match = matchMaterial(materials, draft.name);
	const existing = match.kind === 'existing' ? match : null;
	const kind = existing?.material.trackingType ?? draft.kind;
	const taken = existing
		? items.filter((item) => item.variantId === existing.variant.id).map((item) => item.identifier)
		: [];
	const plan = (problem: string | null, identifiers: string[] = []): Plan => ({
		match,
		kind,
		count: kind === 'INDIVIDUAL' ? identifiers.length : (draft.count ?? 0),
		identifiers,
		taken,
		problem
	});

	if (!draft.name.trim()) return plan('');
	if (match.kind === 'variants') {
		const names = (match.material.variants as Variant[])
			.map((v) => v.name ?? 'ohne Namen')
			.join(', ');
		return plan(`${match.material.name} gibt es als ${names}. Welche?`);
	}
	if (match.kind === 'archived') return plan(`${match.material.name} ist archiviert.`);
	if (match.kind === 'ambiguous') return plan('Mehrere Materialien heißen so.');
	if (existing && kind === 'BULK' && (draft.identifiers || draft.start)) {
		return plan(`${existing.material.name} wird nur gezählt, ohne Nummern.`);
	}
	if (kind === 'BULK') {
		const count = draft.count ?? 0;
		if (count > MAX_COUNT) return plan(`Höchstens ${MAX_COUNT} auf einmal.`);
		return plan(count > 0 ? null : '');
	}
	const identifiers = draft.identifiers ?? autoIdentifiers(taken, draft.start, draft.count ?? 0);
	if (identifiers === null) return plan('Nummern müssen mit einer Zahl enden, z. B. K01.');
	if (identifiers.length === 0) return plan('');
	if (identifiers.length > MAX_ITEMS)
		return plan(`Höchstens ${MAX_ITEMS} Stück auf einmal.`, identifiers);
	const clashes = identifiers.filter((i) => taken.includes(i));
	if (clashes.length) return plan(`${compactList(clashes)} gibt es schon.`, identifiers);
	if (identifiers.some((id, i) => identifiers.indexOf(id) !== i)) {
		return plan('Eine Nummer steht doppelt da.', identifiers);
	}
	return plan(null, identifiers);
}
