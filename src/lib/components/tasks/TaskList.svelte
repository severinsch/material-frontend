<!-- Tasks, optionally grouped by due date; a click opens the task, the check completes an open one. -->
<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import type { Task } from '#lib/api/index.js';
	import { formatDate } from '#lib/format.js';
	import { getTenant } from '#lib/tenant.js';
	import { initials } from '#lib/names.js';
	import { groupLabels, lockedHint, mayComplete, type TaskGroup } from '#lib/tasks.js';
	import TaskCheck from './TaskCheck.svelte';
	import TaskMeta from './TaskMeta.svelte';

	let {
		groups,
		onopen,
		oncheck,
		showLinks = true,
		dense = false
	}: {
		groups: { group: TaskGroup | null; tasks: Task[] }[];
		onopen: (task: Task) => void;
		/** Completes an open task. */
		oncheck: (task: Task) => void;
		showLinks?: boolean;
		dense?: boolean;
	} = $props();

	const tenant = getTenant();
	/** Whether some open task's check is greyed, which is then explained below the list. */
	const locked = $derived(
		groups.some((g) => g.tasks.some((t) => !t.completedAt && !mayComplete(t, tenant)))
	);
</script>

<div class="space-y-5">
	{#each groups as { group, tasks } (group)}
		<section>
			{#if group}
				<h2
					class={[
						'mb-1 px-1 text-sm font-semibold',
						group === 'overdue' ? 'text-destructive' : 'text-muted-foreground'
					]}
				>
					{groupLabels[group]} <span class="font-normal tabular-nums">({tasks.length})</span>
				</h2>
			{/if}
			<ul class="divide-y rounded-md border">
				{#each tasks as task (task.id)}
					<li class={['flex items-start gap-3 px-3', dense ? 'py-2' : 'py-2.5']}>
						<div class="pt-0.5">
							<TaskCheck {task} disabled={!mayComplete(task, tenant)} onclick={oncheck} />
						</div>
						<button type="button" class="min-w-0 flex-1 text-left" onclick={() => onopen(task)}>
							<span class="flex items-center gap-1.5">
								{#if task.urgent && !task.completedAt}
									<CircleAlertIcon class="size-4 shrink-0 text-destructive" aria-label="dringend" />
								{/if}
								<span
									class={['font-medium', task.completedAt && 'text-muted-foreground line-through']}
									>{task.title}</span
								>
							</span>
							{#if task.completedAt}
								<span class="block text-xs text-muted-foreground">
									{formatDate(task.completedAt)} · {task.completedBy}{task.completionNote
										? ` · ${task.completionNote}`
										: ''}
								</span>
							{/if}
							<TaskMeta {task} {showLinks} showLabel={!task.completedAt} />
						</button>
						{#if task.assigneeName && !task.completedAt}
							<span
								title="Zuständig: {task.assigneeName}"
								class="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
								><span aria-hidden="true">{initials(task.assigneeName)}</span><span class="sr-only"
									>Zuständig: {task.assigneeName}</span
								></span
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/each}
	{#if locked}
		<p class="-mt-3 px-1 text-xs text-muted-foreground">{lockedHint}</p>
	{/if}
</div>
