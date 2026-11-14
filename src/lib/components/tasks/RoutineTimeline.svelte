<!-- A routine's tasks on a time line around day 0, placed roughly by their day; drag a task (or use the arrow keys)
     to change its day, click it to edit. On touch screens, dragging starts at the grip, so the rest of a task still
     scrolls the page. -->
<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import type { NewRoutineStep } from '#lib/api/index.js';
	import { offsetText } from '#lib/tasks.js';
	import { getTaskData } from './context.svelte.js';

	let {
		steps,
		anchor,
		markUntitled = false,
		selected = $bindable()
	}: {
		steps: NewRoutineStep[];
		anchor: string;
		/** Highlights steps without a title, once saving was tried. */
		markUntitled?: boolean;
		selected: number | null;
	} = $props();

	const data = getTaskData();
	const memberName = (id: string | null | undefined) =>
		data.members.find((m) => m.userId === id)?.displayName;

	const ROW = 34; // height of a task
	const ANCHOR = 30; // height of the day-0 marker
	const GAP = 4;
	const LABEL_W = 112;
	const LINE_X = LABEL_W + 14;

	/** The scale (first day, px per day); frozen while dragging so the line doesn't stretch under the pointer. */
	function scaleFor(list: NewRoutineStep[]) {
		const days = [0, ...list.map((s) => s.offsetDays)];
		const lo = Math.min(...days) - 2;
		const hi = Math.max(...days) + 2;
		return { lo, perDay: Math.min(28, Math.max(10, 360 / (hi - lo))) };
	}

	let drag = $state<{
		index: number;
		startY: number;
		startOffset: number;
		moved: boolean;
		scale: { lo: number; perDay: number };
	} | null>(null);

	const scale = $derived(drag ? drag.scale : scaleFor(steps));

	type Row =
		| { kind: 'anchor'; day: 0; y: number; h: number }
		| { kind: 'day'; day: number; y: number; h: number; items: number[] };

	/** Rows by day, placed proportionally to the day but never overlapping. */
	const layout = $derived.by(() => {
		/* eslint-disable svelte/prefer-svelte-reactivity -- local to this computation */
		const byDay = new Map<number, number[]>();
		steps.forEach((s, i) => byDay.set(s.offsetDays, [...(byDay.get(s.offsetDays) ?? []), i]));
		const rows: Omit<Row, 'y'>[] = [
			{ kind: 'anchor', day: 0, h: ANCHOR },
			...[...byDay].map(([day, items]) => ({
				kind: 'day' as const,
				day,
				items,
				h: items.length * ROW + (items.length - 1) * GAP
			}))
		];
		// Before the anchor: days < 0; the anchor; then day 0 and later.
		rows.sort((a, b) => a.day - b.day || (a.kind === 'anchor' ? -1 : 1));
		let bottom = -Infinity;
		const placed = rows.map((row) => {
			const y = Math.max((row.day - scale.lo) * scale.perDay, bottom + GAP);
			bottom = y + row.h;
			return { ...row, y } as Row;
		});
		/** Each task's top, so tasks are rendered flat and keep their element (and focus) when their day changes. */
		const tops = new Map<number, number>();
		for (const row of placed)
			if (row.kind === 'day')
				row.items.forEach((index, k) => tops.set(index, row.y + k * (ROW + GAP)));
		return { rows: placed, tops, height: bottom + 16 };
	});

	/** Moves a step to day [offset], at most a year away from day 0 (as the API allows). */
	function moveTo(index: number, offset: number) {
		steps[index].offsetDays = Math.max(-365, Math.min(365, offset));
	}

	function pointerdown(event: PointerEvent, index: number) {
		if (event.button !== 0) return;
		(event.currentTarget as HTMLElement).focus();
		drag = {
			index,
			startY: event.clientY,
			startOffset: steps[index].offsetDays,
			moved: false,
			scale: scaleFor(steps)
		};
	}

	function pointermove(event: PointerEvent) {
		if (!drag) return;
		const dy = event.clientY - drag.startY;
		if (Math.abs(dy) > 4) drag.moved = true;
		if (!drag.moved) return;
		moveTo(drag.index, drag.startOffset + Math.round(dy / drag.scale.perDay));
	}

	/** The browser took over the gesture (e.g. to scroll the page): the task goes back to its day. */
	function pointercancel() {
		if (drag) moveTo(drag.index, drag.startOffset);
		drag = null;
	}

	/** Ends a drag wherever the pointer is released; without movement, it was a click. */
	function pointerup() {
		if (drag && !drag.moved) selected = selected === drag.index ? null : drag.index;
		drag = null;
	}

	function keydown(event: KeyboardEvent, index: number) {
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			moveTo(index, steps[index].offsetDays + (event.key === 'ArrowUp' ? -1 : 1));
		}
	}
</script>

<svelte:window
	onpointermove={pointermove}
	onpointerup={pointerup}
	onpointercancel={pointercancel}
/>

<div class="relative select-none" style="height: {layout.height}px">
	<div class="absolute inset-y-0 w-px bg-border" style="left: {LINE_X}px"></div>
	{#each layout.rows as row (row.kind === 'anchor' ? 'anchor' : row.day)}
		{#if row.kind === 'anchor'}
			<div
				class="absolute right-0 left-0 flex items-center"
				style="top: {row.y}px; height: {row.h}px"
			>
				<span class="shrink-0 pr-3 text-right text-xs font-semibold" style="width: {LABEL_W}px"
					>Tag 0</span
				>
				<span class="size-3 shrink-0 rotate-45 bg-primary" style="margin-left: -6px"></span>
				<span class="pl-4 text-sm font-semibold">{anchor}</span>
			</div>
		{:else}
			<div
				class={[
					'absolute text-right text-xs tabular-nums transition-[top] duration-150',
					drag && steps[drag.index].offsetDays === row.day
						? 'font-medium text-foreground'
						: 'text-muted-foreground'
				]}
				style="top: {row.y + 9}px; width: {LABEL_W}px; padding-right: 12px"
			>
				{offsetText(row.day, anchor)}
			</div>
			<div
				class="absolute size-2.5 rounded-full border-2 border-primary bg-background transition-[top] duration-150"
				style="top: {row.y + 12}px; left: {LINE_X - 5}px"
			></div>
		{/if}
	{/each}
	{#each steps as s, index (index)}
		<button
			type="button"
			class={[
				'absolute right-0 flex items-center gap-2 rounded-md border bg-background px-2 text-left text-sm',
				drag?.index === index
					? 'z-10 cursor-grabbing shadow-lg ring-2 ring-ring/50'
					: 'cursor-grab transition-[top] duration-150 hover:bg-muted',
				selected === index && 'border-primary',
				markUntitled && !s.title.trim() && 'border-destructive'
			]}
			style="top: {layout.tops.get(index)}px; left: {LINE_X + 16}px; height: {ROW}px"
			aria-label="{s.title || 'Neue Aufgabe'}, {offsetText(
				s.offsetDays,
				anchor
			)}. Pfeiltasten verschieben um einen Tag."
			onpointerdown={(e) => pointerdown(e, index)}
			onkeydown={(e) => keydown(e, index)}
			onclick={(e) => {
				// Keyboard activation (pointer clicks are handled on pointerup).
				if (e.detail === 0) selected = selected === index ? null : index;
			}}
		>
			<span class="-mx-2 flex touch-none items-center self-stretch px-2"
				><GripVerticalIcon class="size-4 shrink-0 text-muted-foreground/60" /></span
			>
			{#if s.urgent}<CircleAlertIcon class="size-4 shrink-0 text-destructive" />{/if}
			<span class="min-w-0 flex-1 truncate">{s.title || 'Neue Aufgabe'}</span>
			{#if s.assigneeId}<span class="shrink-0 text-xs text-muted-foreground"
					>{memberName(s.assigneeId)}</span
				>{/if}
		</button>
	{/each}
</div>
