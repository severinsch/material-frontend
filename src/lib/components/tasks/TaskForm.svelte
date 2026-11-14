<!-- A task's fields: the title first, then the note, then the other values as small buttons that show what is set
     (dashed with "+" while empty). -->
<script lang="ts">
	import type { Component, Snippet } from 'svelte';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import PackageIcon from '@lucide/svelte/icons/package';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import TagIcon from '@lucide/svelte/icons/tag';
	import UserIcon from '@lucide/svelte/icons/user';
	import XIcon from '@lucide/svelte/icons/x';
	import { formatDate, today } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import SelectField from '#lib/components/SelectField.svelte';
	import {
		addDays,
		addMonths,
		assigneeOptions,
		countOf,
		intervalOf,
		intervalUnits,
		labelOptions,
		linkNames,
		looseDue,
		monthsOf,
		repeatText,
		taskLabels,
		type Interval,
		type TaskDraft
	} from '#lib/tasks.js';
	import { getTaskData } from './context.svelte.js';
	import NoteEditor from './NoteEditor.svelte';
	import TaskLinkPicker from './TaskLinkPicker.svelte';

	let {
		task = $bindable(),
		autofocus = false,
		assigneeName
	}: {
		task: TaskDraft;
		autofocus?: boolean;
		/** The current assignee's name, in case they aren't among the members any more. */
		assigneeName?: string | null;
	} = $props();

	const data = getTaskData();

	const memberOptions = $derived(assigneeOptions(data.members));

	/** The interval as entered; kept while repeating is off, so switching it on again brings it back. */
	let interval = $state(intervalOf(task.repeatMonths ?? 12));
	const repeating = $derived(task.repeatMonths != null);

	function setRepeat(on: boolean) {
		task.repeatMonths = on ? monthsOf(interval) : null;
	}

	function setInterval(change: Partial<Interval>) {
		interval = { ...interval, ...change };
		task.repeatMonths = monthsOf(interval);
	}

	const now = today();
	const quickDates = [
		{ label: 'Heute', date: now },
		{ label: 'Morgen', date: addDays(now, 1) },
		{ label: 'In 1 Woche', date: addDays(now, 7) },
		{ label: 'In 1 Monat', date: addMonths(now, 1) }
	];

	let openPopover = $state<string | null>(null);

	interface Prop {
		icon: Component;
		label: string;
		/** Shown when set; null when empty. */
		value: string | null;
		title?: string;
		danger?: boolean;
		/** For a toggle (urgent): whether it is on; its text says what it is either way. */
		pressed?: boolean;
	}

	const fields = $derived<Record<string, Prop>>({
		due: {
			icon: CalendarIcon,
			label: 'Fällig',
			value: task.dueDate ? looseDue(task.dueDate) : null,
			title: task.dueDate ? formatDate(task.dueDate) : undefined
		},
		links: {
			icon: PackageIcon,
			label: 'Material',
			value:
				task.materialIds.length + task.itemIds.length
					? linkNames(task, data.targets).join(', ')
					: null
		},
		who: {
			icon: UserIcon,
			label: 'Zuständig',
			value: task.assigneeId
				? (data.members.find((m) => m.userId === task.assigneeId)?.displayName ??
					assigneeName ??
					'Ehemaliges Mitglied')
				: null
		},
		label: {
			icon: TagIcon,
			label: 'Art',
			value: task.label !== 'OTHER' ? taskLabels[task.label] : null
		},
		repeat: {
			icon: RepeatIcon,
			label: 'Wiederholen',
			value: task.repeatMonths ? repeatText(task.repeatMonths) : null
		},
		urgent: {
			icon: CircleAlertIcon,
			label: 'Dringend',
			value: task.urgent ? 'Dringend' : null,
			danger: task.urgent,
			pressed: task.urgent
		}
	});

	const popover = (id: string) => ({
		get open() {
			return openPopover === id;
		},
		set open(value: boolean) {
			openPopover = value ? id : null;
		}
	});
	const duePopover = popover('due');
	const whoPopover = popover('who');
	const labelPopover = popover('label');
	const repeatPopover = popover('repeat');
</script>

<!-- One property's button. [attrs] are the popover trigger's props, if any. -->
{#snippet trigger(p: Prop, attrs: Record<string, unknown> = {}, onclick?: () => void)}
	<!-- onclick first: for popover buttons it is undefined and must not replace the trigger's own handler. -->
	<Button
		{onclick}
		{...attrs}
		type="button"
		size="sm"
		variant={p.value ? 'secondary' : 'outline'}
		title={p.title}
		aria-pressed={p.pressed}
		class={[
			'h-8 max-w-full font-normal pointer-coarse:h-11',
			!p.value && 'border-dashed text-muted-foreground',
			p.danger && 'text-destructive hover:text-destructive'
		]}
	>
		{#if p.value}<p.icon />{:else}<PlusIcon />{/if}
		<span class="truncate"
			>{#if p.value && p.pressed === undefined}<span class="sr-only">{p.label}:</span>
			{/if}{p.value ?? p.label}</span
		>
	</Button>
{/snippet}

{#snippet withPopover(p: Prop, state: { open: boolean }, content: Snippet, width = 'w-56')}
	<Popover.Root bind:open={state.open}>
		<Popover.Trigger>
			{#snippet child({ props: attrs })}{@render trigger(p, attrs)}{/snippet}
		</Popover.Trigger>
		<Popover.Content class="grid gap-2 {width}" align="start">{@render content()}</Popover.Content>
	</Popover.Root>
{/snippet}

{#snippet dueContent()}
	<div class="grid grid-cols-2 gap-1">
		{#each quickDates as q (q.label)}
			<Button
				type="button"
				variant="ghost"
				size="sm"
				class="justify-start"
				onclick={() => {
					task.dueDate = q.date;
					openPopover = null;
				}}>{q.label}</Button
			>
		{/each}
	</div>
	<Input
		type="date"
		value={task.dueDate ?? ''}
		oninput={(e) => (task.dueDate = e.currentTarget.value || null)}
		aria-label="Fällig am"
	/>
	{#if task.dueDate}
		<Button
			type="button"
			variant="ghost"
			size="sm"
			onclick={() => {
				task.dueDate = null;
				openPopover = null;
			}}><XIcon />Kein Datum</Button
		>
	{/if}
{/snippet}

{#snippet whoContent()}
	<div class="grid gap-0.5">
		{#each memberOptions as m (m.value)}
			<Button
				type="button"
				variant={(task.assigneeId ?? '') === m.value ? 'secondary' : 'ghost'}
				size="sm"
				class="justify-start"
				onclick={() => {
					task.assigneeId = m.value || null;
					openPopover = null;
				}}>{m.label}</Button
			>
		{/each}
	</div>
{/snippet}

{#snippet labelContent()}
	<div class="grid gap-0.5">
		{#each labelOptions as l (l.value)}
			<Button
				type="button"
				variant={task.label === l.value ? 'secondary' : 'ghost'}
				size="sm"
				class="justify-start"
				onclick={() => {
					task.label = l.value;
					openPopover = null;
				}}>{l.label}</Button
			>
		{/each}
	</div>
{/snippet}

{#snippet repeatContent()}
	<label class="flex items-center gap-2 text-sm"
		><Switch bind:checked={() => repeating, setRepeat} />Wiederholen</label
	>
	{#if repeating}
		<div class="flex items-center gap-2">
			<span class="text-sm text-muted-foreground">alle</span>
			<!-- An empty field keeps the interval (shown again on leaving it). -->
			<Input
				type="number"
				min="1"
				class="w-20 shrink-0"
				value={interval.n}
				oninput={(e) => {
					const n = countOf(e.currentTarget.valueAsNumber);
					if (n) setInterval({ n });
				}}
				onblur={(e) => (e.currentTarget.value = String(interval.n))}
				aria-label="Anzahl"
			/>
			<SelectField
				bind:value={() => interval.unit, (unit) => setInterval({ unit })}
				options={intervalUnits}
				label="Einheit"
			/>
		</div>
		<p class="text-xs text-muted-foreground">ab Erledigung gerechnet</p>
	{/if}
{/snippet}

<!-- The picker passes its trigger props; the material button looks like the others. -->
{#snippet linksTrigger(attrs: Record<string, unknown>)}{@render trigger(
		fields.links,
		attrs
	)}{/snippet}

<div class="grid gap-3">
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:value={task.title}
		required
		maxlength="255"
		aria-label="Aufgabe"
		placeholder="Was ist zu tun?"
		{autofocus}
		class="-ml-1 w-[calc(100%-1.75rem)] rounded-md bg-transparent px-1 text-lg font-medium outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50 pointer-coarse:w-[calc(100%-2.75rem)]"
	/>
	<NoteEditor
		id="task-note"
		label="Notiz"
		bind:note={() => task.note ?? '', (v) => (task.note = v)}
	/>

	<div class="flex flex-wrap gap-1.5">
		{@render withPopover(fields.due, duePopover, dueContent)}
		<TaskLinkPicker
			bind:materialIds={task.materialIds}
			bind:itemIds={task.itemIds}
			trigger={linksTrigger}
		/>
		{#if data.members.length > 0}
			{@render withPopover(fields.who, whoPopover, whoContent, 'w-48')}
		{:else if fields.who.value}
			<!-- Without EDIT there is no member list: a viewer edits their own task, which stays theirs. -->
			{@render trigger(fields.who, { disabled: true })}
		{/if}
		{@render withPopover(fields.label, labelPopover, labelContent, 'w-44')}
		{@render withPopover(fields.repeat, repeatPopover, repeatContent, 'w-64')}
		{@render trigger(fields.urgent, {}, () => (task.urgent = !task.urgent))}
	</div>
</div>
