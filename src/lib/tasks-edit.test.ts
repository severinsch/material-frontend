import { describe, expect, it } from 'vitest';
import { countOf, getsNext, mayEdit, pasteLines, type NoteLine } from './tasks.js';

const plain = (text: string): NoteLine => ({ check: false, done: false, text });
const box = (text: string, done = false): NoteLine => ({ check: true, done, text });

describe('pasteLines', () => {
	it('continues the line with the first pasted line and adds the others', () => {
		expect(pasteLines(plain('ab'), 1, 1, 'x\ny\nz')).toEqual({
			lines: [plain('ax'), plain('y'), plain('zb')],
			cursor: 1
		});
	});

	it('replaces the selection', () => {
		expect(pasteLines(plain('abcd'), 1, 3, 'x\ny')).toEqual({
			lines: [plain('ax'), plain('yd')],
			cursor: 1
		});
	});

	it('handles Windows line breaks and a trailing one', () => {
		expect(pasteLines(plain(''), 0, 0, 'x\r\ny\r\n')).toEqual({
			lines: [plain('x'), plain('y'), plain('')],
			cursor: 0
		});
	});

	it('makes the pasted lines checkboxes in a checkbox line', () => {
		expect(pasteLines(box('a', true), 1, 1, 'x\ny')).toEqual({
			lines: [box('ax', true), box('y')],
			cursor: 1
		});
	});

	it('keeps checkboxes written as such', () => {
		expect(pasteLines(plain(''), 0, 0, '[ ] x\n[x] y\nz')).toEqual({
			lines: [box('x'), box('y', true), plain('z')],
			cursor: 1
		});
	});

	it('keeps the first pasted checkbox as text in the middle of a line', () => {
		expect(pasteLines(plain('a'), 1, 1, '[ ] x\ny').lines).toEqual([plain('ax'), plain('y')]);
	});
});

describe('mayEdit', () => {
	const tenant = (edit: boolean) => ({ can: () => edit, user: { id: 'me' } });

	it.each([
		[true, null, true],
		[true, 'other', true],
		[false, 'me', true],
		[false, 'other', false],
		[false, null, false]
	])('with EDIT %s, assignee %s: %s', (edit, assigneeId, may) => {
		expect(mayEdit({ assigneeId }, tenant(edit))).toBe(may);
	});
});

describe('countOf', () => {
	it.each([
		[3, Infinity, 3],
		[2.6, Infinity, 3],
		[400, 365, 365],
		[0, Infinity, null],
		[-2, Infinity, null],
		[NaN, Infinity, null]
	])('countOf(%d, %d) is %s', (value, max, count) => {
		expect(countOf(value, max)).toBe(count);
	});
});

describe('getsNext', () => {
	const items = new Map([
		['active', { status: 'ACTIVE' as const }],
		['repair', { status: 'IN_REPAIR' as const }],
		['lost', { status: 'LOST' as const }],
		['gone', { status: 'DECOMMISSIONED' as const }]
	]);
	const task = (repeatMonths: number | null, ruleId: string | null, itemIds: string[]) => ({
		repeatMonths,
		ruleId,
		itemIds
	});

	it("is false for a task that doesn't repeat", () => {
		expect(getsNext(task(null, null, []), items)).toBe(false);
	});

	it('is true for a repeating task without a rule, whatever its items', () => {
		expect(getsNext(task(12, null, ['lost']), items)).toBe(true);
	});

	it.each([
		[['active'], true],
		[['repair'], true],
		[['lost', 'active'], true],
		[['lost'], false],
		[['gone'], false],
		[['unknown'], false],
		[[], false]
	])("for a rule's task with items %j: %s", (itemIds, next) => {
		expect(getsNext(task(12, 'rule', itemIds), items)).toBe(next);
	});
});
