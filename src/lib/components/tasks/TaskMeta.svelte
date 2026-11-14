<!-- The quiet line under a task's title: due date, what it's about, interval, checklist, assignee, label. -->
<script lang="ts">
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import PackageIcon from '@lucide/svelte/icons/package';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import type { Task } from '#lib/api/index.js';
	import { formatDate } from '#lib/format.js';
	import {
		checklistProgress,
		isOverdue,
		linkNames,
		looseDue,
		repeatText,
		taskLabels
	} from '#lib/tasks.js';
	import { getTaskData } from './context.svelte.js';

	let {
		task,
		showDue = true,
		showLinks = true,
		showLabel = true,
		showAssignee = false
	}: {
		task: Task;
		showDue?: boolean;
		showLinks?: boolean;
		showLabel?: boolean;
		/** As text; lists show the assignee as a separate avatar. */
		showAssignee?: boolean;
	} = $props();

	const data = getTaskData();
	const names = $derived(linkNames(task, data.targets));
	const progress = $derived(task.completedAt ? undefined : checklistProgress(task.note));
</script>

<div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
	{#if showDue && task.dueDate && !task.completedAt}
		<span
			class={['inline-flex items-center gap-1', isOverdue(task) && 'font-medium text-destructive']}
			title={formatDate(task.dueDate)}
		>
			<CalendarIcon class="size-3.5" />{looseDue(task.dueDate)}
		</span>
	{/if}
	{#if showLinks && names.length > 0}
		<span class="inline-flex min-w-0 items-center gap-1" title={names.join(', ')}>
			<PackageIcon class="size-3.5 shrink-0" />
			<span class="truncate"
				>{names.slice(0, 2).join(', ')}{names.length > 2 ? ` +${names.length - 2}` : ''}</span
			>
		</span>
	{/if}
	{#if task.repeatMonths}
		<span class="inline-flex items-center gap-1"
			><RepeatIcon class="size-3.5" />{repeatText(task.repeatMonths)}</span
		>
	{/if}
	{#if progress}
		<span class="inline-flex items-center gap-1 tabular-nums"
			><ListChecksIcon class="size-3.5" />{progress.done}/{progress.total}</span
		>
	{/if}
	{#if showAssignee && task.assigneeName}
		<span>{task.assigneeName}</span>
	{/if}
	{#if showLabel && task.label !== 'OTHER'}
		<span class="rounded border px-1 leading-4">{taskLabels[task.label]}</span>
	{/if}
</div>
