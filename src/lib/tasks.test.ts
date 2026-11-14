import { describe, expect, it } from 'vitest';
import type { IndividualItem, Material, Task } from '#lib/api/index.js';
import {
	addMonths,
	assigneeOptions,
	checklistProgress,
	durationText,
	grouped,
	groupOf,
	historyOf,
	intervalOf,
	isOverdue,
	linkNames,
	looseDue,
	loosePast,
	materialIdsOf,
	mayComplete,
	monthsOf,
	offsetText,
	parseNote,
	repeatText,
	serializeNote,
	targetsOf,
	taskCount,
	toggleLine
} from './tasks.js';

const today = '2026-11-13';

function task(overrides: Partial<Task>): Task {
	return {
		id: 't',
		title: 'Aufgabe',
		urgent: false,
		label: 'OTHER',
		materialIds: [],
		itemIds: [],
		...overrides
	};
}

describe('dates', () => {
	it('says due dates loosely', () => {
		expect(looseDue('2026-03-12', today)).toBe('seit 8 Monaten überfällig');
		expect(looseDue('2026-11-10', today)).toBe('seit 3 Tagen überfällig');
		expect(looseDue('2026-11-12', today)).toBe('seit gestern überfällig');
		expect(looseDue('2026-11-13', today)).toBe('heute');
		expect(looseDue('2026-11-14', today)).toBe('morgen');
		expect(looseDue('2026-11-20', today)).toBe('in 7 Tagen');
		expect(looseDue('2026-12-11', today)).toBe('in 4 Wochen');
		expect(looseDue('2026-12-31', today)).toBe('in 7 Wochen');
		expect(looseDue('2027-03-31', today)).toBe('März 2027');
	});

	it('says past dates loosely', () => {
		expect(loosePast('2026-11-13', today)).toBe('heute');
		expect(loosePast('2026-11-10', today)).toBe('vor 3 Tagen');
		expect(loosePast('2025-11-01', today)).toBe('im November 2025');
	});

	it('adds months like the server, clamping to the end of the month', () => {
		expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
		expect(addMonths('2022-03-31', 60)).toBe('2027-03-31');
		expect(addMonths('2026-11-13', 12)).toBe('2027-11-13');
	});

	it('names intervals and offsets', () => {
		expect(repeatText(12)).toBe('jährlich');
		expect(repeatText(60)).toBe('alle 5 Jahre');
		expect(repeatText(6)).toBe('alle 6 Monate');
		expect(offsetText(-14, 'Lagerbeginn')).toBe('14 Tage vorher');
		expect(offsetText(0, 'Lagerbeginn')).toBe('Lagerbeginn');
		expect(offsetText(0, 'Abfahrt')).toBe('Abfahrt');
		expect(offsetText(1, 'Lagerende')).toBe('1 Tag danach');
	});
});

describe('grouping', () => {
	it('groups by due date, urgent first', () => {
		const groups = grouped(
			[
				task({ id: 'a', dueDate: '2027-01-01' }),
				task({ id: 'b' }),
				task({ id: 'c', dueDate: '2026-11-20' }),
				task({ id: 'd', dueDate: '2026-11-01' }),
				task({ id: 'e', dueDate: '2026-11-25', urgent: true })
			],
			today
		);
		expect(groups.map((g) => [g.group, g.tasks.map((t) => t.id)])).toEqual([
			['overdue', ['d']],
			['soon', ['e', 'c']],
			['later', ['a']],
			['none', ['b']]
		]);
	});

	it('follows the history of a recurring task', () => {
		const first = task({ id: '1', completedAt: '2024-11-01T10:00:00Z' });
		const second = task({ id: '2', previousId: '1', completedAt: '2025-11-01T10:00:00Z' });
		const open = task({ id: '3', previousId: '2' });
		const byId = new Map([first, second, open].map((t) => [t.id, t]));
		expect(historyOf(open, byId).map((t) => t.id)).toEqual(['2', '1']);
	});
});

describe('checklists', () => {
	const note = 'Vor jedem Lager\n[x] Pflaster\n[ ] Rettungsdecke';

	it('parses and serializes notes', () => {
		expect(parseNote(note)).toEqual([
			{ check: false, done: false, text: 'Vor jedem Lager' },
			{ check: true, done: true, text: 'Pflaster' },
			{ check: true, done: false, text: 'Rettungsdecke' }
		]);
		expect(serializeNote(parseNote(note))).toBe(note);
		expect(checklistProgress(note)).toEqual({ done: 1, total: 2 });
		expect(checklistProgress('Nur Text')).toBeUndefined();
	});

	it('toggles a box', () => {
		expect(toggleLine(note, 2)).toBe('Vor jedem Lager\n[x] Pflaster\n[x] Rettungsdecke');
	});
});

describe('edge cases', () => {
	// today = 2026-11-13: +13 days = 11-26, +14 = 11-27, +59 = 2027-01-11, +60 = 2027-01-12.
	it.each([
		['2026-11-26', 'in 13 Tagen', 'soon'],
		['2026-11-27', 'in 2 Wochen', 'later'],
		['2027-01-11', 'in 8 Wochen', 'later'],
		['2027-01-12', 'Januar 2027', 'later'],
		['2026-09-15', 'seit 59 Tagen überfällig', 'overdue'],
		['2026-09-14', 'seit 2 Monaten überfällig', 'overdue']
	])('due %s is "%s" and %s', (dueDate, text, group) => {
		expect(looseDue(dueDate, today)).toBe(text);
		expect(groupOf({ dueDate }, today)).toBe(group);
	});

	it.each([
		['2024-11-14', 'seit 24 Monaten überfällig'], // 729 days
		['2024-11-13', 'seit 2 Jahren überfällig'], // 730 days
		['2024-09-10', 'seit 2 Jahren überfällig'], // 26 months
		['2023-11-13', 'seit 3 Jahren überfällig']
	])('says long overdue %s in years: "%s"', (dueDate, text) => {
		expect(looseDue(dueDate, today)).toBe(text);
	});

	it('names the month without the year only within the same year', () => {
		expect(looseDue('2026-03-02', '2026-01-01')).toBe('im März');
		expect(looseDue('2027-03-02', '2026-11-13')).toBe('März 2027');
		// The year counts, not the distance: December next year still gets its year.
		expect(looseDue('2027-12-01', '2027-01-01')).toBe('im Dezember');
		expect(looseDue('2028-01-31', '2027-11-13')).toBe('Januar 2028');
	});

	it.each([
		['2026-11-12T23:30:00Z', 'heute'], // 00:30 in Germany (CET)
		['2026-11-12T22:59:59Z', 'gestern'], // 23:59:59 in Germany
		['2026-11-12T23:00:00Z', 'heute'], // midnight in Germany
		['2026-11-13T22:30:00Z', 'heute'], // already tomorrow in Germany: not in the past, still "heute"
		['2026-11-14', 'heute'] // a future date is never "in the past"
	])('says the past timestamp %s in German time: %s', (value, text) => {
		expect(loosePast(value, today)).toBe(text);
	});

	it('uses summer time near midnight', () => {
		expect(loosePast('2026-07-31T22:30:00Z', '2026-08-01')).toBe('heute'); // 00:30 CEST
		expect(loosePast('2026-07-31T21:59:00Z', '2026-08-01')).toBe('gestern'); // 23:59 CEST
	});

	it.each([
		[{ dueDate: '2026-11-12' }, true],
		[{ dueDate: '2026-11-13' }, false],
		[{ dueDate: null }, false],
		[{ dueDate: '2026-11-12', completedAt: '2026-11-13T08:00:00Z' }, false],
		[{ dueDate: '2026-01-01', completedAt: '2026-11-10T08:00:00Z' }, false]
	])('isOverdue(%o) is %s', (t, overdue) => {
		expect(isOverdue(t, today)).toBe(overdue);
	});

	it('skips reopened (open) tasks in the history and stops at a missing one', () => {
		const lost = task({ id: '0', completedAt: '2023-11-01T10:00:00Z' });
		const first = task({ id: '1', previousId: 'gone', completedAt: '2024-11-01T10:00:00Z' });
		const reopened = task({ id: '2', previousId: '1' });
		const current = task({ id: '3', previousId: '2' });
		const byId = new Map([lost, first, reopened, current].map((t) => [t.id, t]));
		expect(historyOf(current, byId).map((t) => t.id)).toEqual(['1']);
		expect(historyOf(lost, byId)).toEqual([]);
	});

	it.each([
		['[x]Pflaster', { check: true, done: true, text: 'Pflaster' }],
		['[ ]', { check: true, done: false, text: '' }],
		['[ ]  zwei Leerzeichen', { check: true, done: false, text: ' zwei Leerzeichen' }],
		// Only the exact "[ ]"/"[x]" at the line start is a box (as written by the editor):
		['[X] Groß', { check: false, done: false, text: '[X] Groß' }],
		['- [ ] Markdown', { check: false, done: false, text: '- [ ] Markdown' }],
		[' [ ] eingerückt', { check: false, done: false, text: ' [ ] eingerückt' }],
		['[] leer', { check: false, done: false, text: '[] leer' }]
	])('parses the line "%s"', (line, parsed) => {
		expect(parseNote(line)).toEqual([parsed]);
	});

	it('keeps empty lines and normalizes boxes when serializing', () => {
		const note = 'Kopf\n\n[x]Pflaster\n\n[ ] Decke';
		const empty = { check: false, done: false, text: '' };
		expect(parseNote(note).filter((_, i) => i % 2)).toEqual([empty, empty]);
		expect(serializeNote(parseNote(note))).toBe('Kopf\n\n[x] Pflaster\n\n[ ] Decke');
		expect(checklistProgress(note)).toEqual({ done: 1, total: 2 });
		expect(parseNote(null)).toEqual([]);
		expect(parseNote('')).toEqual([]);
	});

	it('leaves a note unchanged when toggling a line without a box', () => {
		const note = 'Vor jedem Lager\n[x] Pflaster';
		expect(toggleLine(note, 0)).toBe(note);
		expect(toggleLine(note, 1)).toBe('Vor jedem Lager\n[ ] Pflaster');
	});

	const targets = targetsOf(
		[
			{ id: 'gas', name: 'Gasflasche', variants: [{ id: 'gas-5', name: '5 kg' }] },
			{ id: 'kohte', name: 'Kohte', variants: [{ id: 'kohte', name: null }] }
		] as Material[],
		[
			{ id: 'k03', variantId: 'kohte', identifier: 'K03' },
			{ id: 'orphan', variantId: 'gone', identifier: 'X1' }
		] as IndividualItem[]
	);

	it('names unknown links instead of failing', () => {
		expect(
			linkNames({ materialIds: ['gas', 'gone'], itemIds: ['k03', 'gone', 'orphan'] }, targets)
		).toEqual([
			'Gasflasche',
			'Unbekanntes Material',
			'Kohte K03',
			'Unbekannter Gegenstand',
			'Unbekanntes Material X1'
		]);
	});

	it('collects the materials of linked items, without unknown ones or duplicates', () => {
		expect(
			materialIdsOf({ materialIds: ['kohte', 'gone'], itemIds: ['k03', 'gone', 'orphan'] }, targets)
		).toEqual(['kohte', 'gone']);
		expect(materialIdsOf({ materialIds: [], itemIds: ['k03'] }, targets)).toEqual(['kohte']);
	});

	const tenant = (edit: boolean) => ({ can: () => edit, user: { id: 'me' } });

	it.each([
		[true, 'other', true],
		[true, null, true],
		[false, 'me', true],
		[false, 'other', false],
		[false, null, false],
		[false, undefined, false]
	])('mayComplete with EDIT %s, assignee %s: %s', (edit, assigneeId, may) => {
		expect(mayComplete({ assigneeId }, tenant(edit))).toBe(may);
	});

	it.each([
		[1, 'monatlich'],
		[18, 'alle 18 Monate'],
		[24, 'alle 2 Jahre']
	])('repeatText(%i) is "%s"', (months, text) => {
		expect(repeatText(months)).toBe(text);
	});

	it('names offsets without an anchor and of one day before', () => {
		expect(offsetText(0, '')).toBe('Tag 0');
		expect(offsetText(-1, 'Lagerbeginn')).toBe('1 Tag vorher');
	});
});

describe('intervals', () => {
	it.each([
		[12, { n: 1, unit: 'YEARS' }, '1 Jahr'],
		[60, { n: 5, unit: 'YEARS' }, '5 Jahre'],
		[1, { n: 1, unit: 'MONTHS' }, '1 Monat'],
		[18, { n: 18, unit: 'MONTHS' }, '18 Monate']
	] as const)('%i months are entered as %o and said "%s"', (months, interval, text) => {
		expect(intervalOf(months)).toEqual(interval);
		expect(monthsOf(interval)).toBe(months);
		expect(durationText(months)).toBe(text);
	});

	it('counts an empty or invalid number as 1', () => {
		expect(monthsOf({ n: 0, unit: 'YEARS' })).toBe(12);
		expect(monthsOf({ n: Number.NaN, unit: 'MONTHS' })).toBe(1);
		expect(monthsOf({ n: null as unknown as number, unit: 'MONTHS' })).toBe(1);
		expect(monthsOf({ n: -3, unit: 'MONTHS' })).toBe(1);
		expect(monthsOf({ n: 2.4, unit: 'YEARS' })).toBe(24);
	});
});

describe('texts and options', () => {
	it('counts tasks', () => {
		expect(taskCount(1)).toBe('1 Aufgabe');
		expect(taskCount(0)).toBe('0 Aufgaben');
		expect(taskCount(3)).toBe('3 Aufgaben');
	});

	it('offers nobody first, then the members', () => {
		expect(assigneeOptions([{ userId: 'u1', displayName: 'Max' }])).toEqual([
			{ value: '', label: 'Niemand' },
			{ value: 'u1', label: 'Max' }
		]);
	});
});
