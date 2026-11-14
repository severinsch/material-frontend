<!-- The round "done" check in front of a task; inert for completed tasks (they are reopened in their dialog, so a stray
     tap can't undo a completion) and greyed for tasks the user can't complete (see `lockedHint`). -->
<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import type { Task } from '#lib/api/index.js';

	import { lockedHint } from '#lib/tasks.js';

	let {
		task,
		disabled = false,
		onclick
	}: { task: Task; disabled?: boolean; onclick: (task: Task) => void } = $props();
</script>

{#snippet circle()}
	<span
		class={[
			'flex size-5 items-center justify-center rounded-full border-2 transition-colors',
			task.completedAt
				? 'border-primary bg-primary text-primary-foreground'
				: task.urgent
					? 'border-destructive/70 group-hover:bg-destructive/10'
					: 'border-muted-foreground/40 group-hover:border-primary group-hover:bg-primary/10',
			disabled && !task.completedAt && 'opacity-50'
		]}
	>
		<CheckIcon
			class={[
				'size-3.5 transition-opacity',
				task.completedAt ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'
			]}
		/>
	</span>
{/snippet}

{#if task.completedAt}
	<!-- Inert, but tells screen readers that the task is done. -->
	<span
		class="-m-2.5 flex shrink-0 items-center justify-center p-2.5"
		role="img"
		aria-label="Erledigt">{@render circle()}</span
	>
{:else if disabled}
	<span
		class="-m-2.5 flex shrink-0 items-center justify-center p-2.5"
		aria-hidden="true"
		title={lockedHint}>{@render circle()}</span
	>
{:else}
	<!-- A 44 px touch target around a small circle. -->
	<button
		type="button"
		class="group -m-2.5 flex shrink-0 items-center justify-center p-2.5"
		aria-label="„{task.title}“ als erledigt markieren"
		onclick={(event) => {
			event.stopPropagation();
			onclick(task);
		}}
	>
		{@render circle()}
	</button>
{/if}
