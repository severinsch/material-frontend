import type { IndividualItem, Material, Member, NewTask, Task, TaskLabel } from '#lib/api/index.js';
import { itemNameOf, optionsOf, today as todayInGermany, type VariantOf } from '#lib/format.js';
import { isRetired } from '#lib/items.js';

export const taskLabels: Record<TaskLabel, string> = {
	INSPECTION: 'Prüfung',
	REPAIR: 'Reparatur',
	CARE: 'Pflege',
	PURCHASE: 'Einkauf',
	OTHER: 'Sonstiges'
};

export const labelOptions = optionsOf(taskLabels);

/** Options to assign a task to one of [members], or to nobody (value ''). */
export function assigneeOptions(members: Pick<Member, 'userId' | 'displayName'>[]) {
	return [
		{ value: '', label: 'Niemand' },
		...members.map((m) => ({ value: m.userId, label: m.displayName }))
	];
}

// ========= Dates (`YYYY-MM-DD`) =========

const DAY = 86_400_000;
const parse = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);

/** Days from [from] to [to], negative if [to] is earlier. */
export function daysBetween(from: string, to: string): number {
	return Math.round((parse(to) - parse(from)) / DAY);
}

export function addDays(date: string, days: number): string {
	return iso(parse(date) + days * DAY);
}

/** [months] later; the 31st becomes the last day of a shorter month, as on the server. */
export function addMonths(date: string, months: number): string {
	const d = new Date(parse(date));
	const day = d.getUTCDate();
	d.setUTCDate(1);
	d.setUTCMonth(d.getUTCMonth() + months);
	const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
	d.setUTCDate(Math.min(day, lastDay));
	return iso(d.getTime());
}

const monthFormat = (withYear: boolean) =>
	new Intl.DateTimeFormat('de-DE', {
		timeZone: 'UTC',
		month: 'long',
		...(withYear ? { year: 'numeric' } : {})
	});

/**
 * A due date said loosely: "seit 2 Jahren überfällig", "seit 3 Tagen überfällig", "morgen", "in 2 Wochen", "im März",
 * "März 2028".
 */
export function looseDue(date: string, today = todayInGermany()): string {
	const d = daysBetween(today, date);
	if (d <= -730) return `seit ${Math.floor(-d / 365)} Jahren überfällig`;
	if (d <= -60) return `seit ${Math.round(-d / 30)} Monaten überfällig`;
	if (d < -1) return `seit ${-d} Tagen überfällig`;
	if (d === -1) return 'seit gestern überfällig';
	if (d === 0) return 'heute';
	if (d === 1) return 'morgen';
	if (d < 14) return `in ${d} Tagen`;
	if (d < 60) return `in ${Math.round(d / 7)} Wochen`;
	const sameYear = date.slice(0, 4) === today.slice(0, 4);
	return `${sameYear ? 'im ' : ''}${monthFormat(!sameYear).format(new Date(parse(date)))}`;
}

/** A past date or timestamp said loosely: "heute", "vor 3 Tagen", "im Oktober 2026". */
export function loosePast(value: string, today = todayInGermany()): string {
	const date = value.length > 10 ? isoInGermany(value) : value;
	const d = daysBetween(date, today);
	if (d <= 0) return 'heute';
	if (d === 1) return 'gestern';
	if (d < 14) return `vor ${d} Tagen`;
	if (d < 60) return `vor ${Math.round(d / 7)} Wochen`;
	return `im ${monthFormat(true).format(new Date(parse(date)))}`;
}

const isoDateInGermany = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' });
const isoInGermany = (timestamp: string) => isoDateInGermany.format(new Date(timestamp));

// ========= Intervals =========

/** An interval as entered: every [n] months or years. */
export interface Interval {
	n: number;
	unit: 'MONTHS' | 'YEARS';
}

export const intervalUnits: { value: Interval['unit']; label: string }[] = [
	{ value: 'MONTHS', label: 'Monate' },
	{ value: 'YEARS', label: 'Jahre' }
];

/** [months] as entered: in years if they are whole years. */
export function intervalOf(months: number): Interval {
	return months % 12 === 0 ? { n: months / 12, unit: 'YEARS' } : { n: months, unit: 'MONTHS' };
}

/** The months of [interval]; at least 1, also for an empty or invalid number. */
export function monthsOf({ n, unit }: Interval): number {
	return Math.max(1, Math.round(n) || 1) * (unit === 'YEARS' ? 12 : 1);
}

/**
 * A count entered in a number field (interval, days), rounded and at most [max]; null for an empty or non-positive
 * input, which the field ignores (keeping the previous value) instead of turning it into 1 or 0.
 */
export function countOf(value: number, max = Infinity): number | null {
	const n = Math.min(max, Math.round(value));
	return n >= 1 ? n : null;
}

/** "jährlich", "alle 5 Jahre", "monatlich", "alle 18 Monate". */
export function repeatText(months: number): string {
	if (months % 12 === 0) return months === 12 ? 'jährlich' : `alle ${months / 12} Jahre`;
	return months === 1 ? 'monatlich' : `alle ${months} Monate`;
}

/** "1 Jahr", "5 Jahre", "1 Monat", "18 Monate". */
export function durationText(months: number): string {
	const { n, unit } = intervalOf(months);
	return unit === 'YEARS'
		? `${n} ${n === 1 ? 'Jahr' : 'Jahre'}`
		: `${n} ${n === 1 ? 'Monat' : 'Monate'}`;
}

/** "1 Aufgabe", "3 Aufgaben". */
export const taskCount = (n: number) => `${n} ${n === 1 ? 'Aufgabe' : 'Aufgaben'}`;

/** "14 Tage vorher", "Lagerbeginn" (day 0 is named as is, which reads right whatever its gender), "1 Tag danach". */
export function offsetText(offset: number, anchor: string): string {
	if (offset === 0) return anchor || 'Tag 0';
	const n = Math.abs(offset);
	return `${n} ${n === 1 ? 'Tag' : 'Tage'} ${offset < 0 ? 'vorher' : 'danach'}`;
}

// ========= Grouping =========

export type TaskGroup = 'overdue' | 'soon' | 'later' | 'none';

export const groupLabels: Record<TaskGroup, string> = {
	overdue: 'Überfällig',
	soon: 'Nächste 2 Wochen',
	later: 'Später',
	none: 'Ohne Datum'
};

/** Days that count as "soon". */
export const SOON_DAYS = 14;

export function groupOf(task: Pick<Task, 'dueDate'>, today = todayInGermany()): TaskGroup {
	if (!task.dueDate) return 'none';
	const d = daysBetween(today, task.dueDate);
	return d < 0 ? 'overdue' : d < SOON_DAYS ? 'soon' : 'later';
}

export const isOverdue = (task: Pick<Task, 'dueDate' | 'completedAt'>, today = todayInGermany()) =>
	!task.completedAt && !!task.dueDate && task.dueDate < today;

/** Urgent first, then by due date (none last), then by title. */
export function compareTasks(a: Task, b: Task): number {
	return (
		Number(b.urgent) - Number(a.urgent) ||
		(a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
		a.title.localeCompare(b.title, 'de')
	);
}

export function grouped(tasks: Task[], today = todayInGermany()) {
	const order: TaskGroup[] = ['overdue', 'soon', 'later', 'none'];
	return order
		.map((group) => ({
			group,
			tasks: tasks.filter((t) => groupOf(t, today) === group).toSorted(compareTasks)
		}))
		.filter((g) => g.tasks.length > 0);
}

/** Earlier completions of a recurring task, newest first, following [Task.previousId]. */
export function historyOf(task: Task, byId: ReadonlyMap<string, Task>): Task[] {
	const history: Task[] = [];
	let previous = task.previousId ? byId.get(task.previousId) : undefined;
	while (previous && history.length < 50) {
		if (previous.completedAt) history.push(previous);
		previous = previous.previousId ? byId.get(previous.previousId) : undefined;
	}
	return history;
}

// ========= Notes and checklists =========

export interface NoteLine {
	check: boolean;
	done: boolean;
	text: string;
}

export function parseNote(note: string | null | undefined): NoteLine[] {
	if (!note) return [];
	return note.split('\n').map((line) => {
		const m = /^\[( |x)\] ?(.*)$/.exec(line);
		return m
			? { check: true, done: m[1] === 'x', text: m[2] }
			: { check: false, done: false, text: line };
	});
}

export function serializeNote(lines: NoteLine[]): string {
	return lines.map((l) => (l.check ? `[${l.done ? 'x' : ' '}] ${l.text}` : l.text)).join('\n');
}

export function checklistProgress(note: string | null | undefined) {
	const checks = parseNote(note).filter((l) => l.check);
	return checks.length
		? { done: checks.filter((l) => l.done).length, total: checks.length }
		: undefined;
}

/** The note with the checkbox in line [index] toggled. */
export function toggleLine(note: string, index: number): string {
	const lines = parseNote(note);
	lines[index].done = !lines[index].done;
	return serializeNote(lines);
}

/**
 * The lines that replace [line] when [text] with line breaks is pasted over its characters [start] to [end]: the first
 * pasted line continues it (and makes it a checkbox if pasted at its start as one), the others follow as their own
 * lines, checkboxes if [line] is one or they are written as "[ ] …". [cursor] is where the pasted text ends in the
 * last line.
 */
export function pasteLines(
	line: NoteLine,
	start: number,
	end: number,
	text: string
): { lines: NoteLine[]; cursor: number } {
	const [first, ...more] = parseNote(text.replace(/\r\n?/g, '\n'));
	const before = line.text.slice(0, start);
	const head =
		!before && first.check
			? { check: true, done: first.done, text: first.text }
			: { ...line, text: before + first.text };
	const lines = [head, ...more.map((l) => ({ ...l, check: l.check || line.check }))];
	const last = lines[lines.length - 1];
	const cursor = last.text.length;
	last.text += line.text.slice(end);
	return { lines, cursor };
}

// ========= Names =========

/** Lookups for the names of what tasks are about. */
export interface TaskTargets {
	materials: ReadonlyMap<string, Material>;
	items: ReadonlyMap<string, IndividualItem>;
	variants: ReadonlyMap<string, VariantOf>;
}

export function targetsOf(materials: Material[], items: IndividualItem[]): TaskTargets {
	return {
		materials: new Map(materials.map((m) => [m.id, m])),
		items: new Map(items.map((i) => [i.id, i])),
		variants: new Map(
			materials.flatMap((material) =>
				material.variants.map((variant) => [variant.id, { material, variant }] as const)
			)
		)
	};
}

/** Names of the materials and items a task is about, e.g. ["Gasflasche 5 kg", "Kohte K03"]. */
export function linkNames(
	task: Pick<Task, 'materialIds' | 'itemIds'>,
	{ materials, items, variants }: TaskTargets
): string[] {
	return [
		...task.materialIds.map((id) => materials.get(id)?.name ?? 'Unbekanntes Material'),
		...task.itemIds.map((id) => {
			const item = items.get(id);
			return item ? itemNameOf(variants, item) : 'Unbekannter Gegenstand';
		})
	];
}

/** The material of each linked item, for "tasks about this material" checks. */
export function materialIdsOf(
	task: Pick<Task, 'materialIds' | 'itemIds'>,
	{ items, variants }: TaskTargets
): string[] {
	const ofItems = task.itemIds.flatMap((id) => {
		const item = items.get(id);
		const material = item && variants.get(item.variantId)?.material;
		return material ? [material.id] : [];
	});
	return [...new Set([...task.materialIds, ...ofItems])];
}

// ========= Editing =========

/** All fields of a task's form, as sent to the API. */
export type TaskDraft = Required<
	Omit<NewTask, 'note' | 'dueDate' | 'assigneeId' | 'repeatMonths' | 'damageReportId'>
> &
	Pick<NewTask, 'note' | 'dueDate' | 'assigneeId' | 'repeatMonths' | 'damageReportId'>;

export function emptyDraft(preset: Partial<TaskDraft> = {}): TaskDraft {
	return {
		title: '',
		note: '',
		dueDate: null,
		urgent: false,
		label: 'OTHER',
		assigneeId: null,
		repeatMonths: null,
		materialIds: [],
		itemIds: [],
		damageReportId: null,
		...preset
	};
}

/** The editable values of [task], e.g. to send it back with one change. */
export function draftOf(task: Task): TaskDraft {
	return {
		title: task.title,
		note: task.note ?? '',
		dueDate: task.dueDate ?? null,
		urgent: task.urgent,
		label: task.label,
		assigneeId: task.assigneeId ?? null,
		repeatMonths: task.repeatMonths ?? null,
		materialIds: task.materialIds,
		itemIds: task.itemIds,
		damageReportId: task.damageReportId ?? null
	};
}

/**
 * Whether the user may edit [task] (its fields, ticking its checklist): editors all tasks, others those assigned to
 * them, without passing them on. Creating and deleting tasks needs EDIT.
 */
export function mayEdit(
	task: Pick<Task, 'assigneeId'>,
	tenant: { can(permission: 'EDIT'): boolean; user: { id: string } }
): boolean {
	return tenant.can('EDIT') || task.assigneeId === tenant.user.id;
}

/**
 * Whether completing [task] creates a next one: if it repeats, and for a rule's task only while one of its items is
 * still in use (the server creates none for lost or decommissioned items). Unknown items count as gone.
 */
export function getsNext(
	task: Pick<Task, 'repeatMonths' | 'ruleId' | 'itemIds'>,
	items: ReadonlyMap<string, Pick<IndividualItem, 'status'>>
): boolean {
	if (!task.repeatMonths) return false;
	if (!task.ruleId) return true;
	return task.itemIds.some((id) => {
		const item = items.get(id);
		return !!item && !isRetired(item);
	});
}

/** Why a task's check is greyed for the user (see [mayComplete]). */
export const lockedHint = 'Erledigen kann, wem die Aufgabe zugewiesen ist.';

/** Whether the user may complete (and reopen) [task]: editors all tasks, others those assigned to them. */
export function mayComplete(
	task: Pick<Task, 'assigneeId'>,
	tenant: { can(permission: 'EDIT'): boolean; user: { id: string } }
): boolean {
	return tenant.can('EDIT') || task.assigneeId === tenant.user.id;
}
