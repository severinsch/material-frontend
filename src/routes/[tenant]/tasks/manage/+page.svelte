<script lang="ts">
	import type { Snippet } from 'svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlayIcon from '@lucide/svelte/icons/play';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { mutate, type TaskRoutine, type TaskRule } from '#lib/api/index.js';
	import { formatDate, itemNameOf } from '#lib/format.js';
	import { isRetired } from '#lib/items.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import RowActions from '#lib/components/RowActions.svelte';
	import { provideTaskData } from '#lib/components/tasks/context.svelte.js';
	import InfoHint from '#lib/components/tasks/InfoHint.svelte';
	import RoutineDialog from '#lib/components/tasks/RoutineDialog.svelte';
	import RoutineStartDialog from '#lib/components/tasks/RoutineStartDialog.svelte';
	import RuleDialog from '#lib/components/tasks/RuleDialog.svelte';
	import TaskDialogs from '#lib/components/tasks/TaskDialogs.svelte';
	import {
		compareTasks,
		historyOf,
		isOverdue,
		linkNames,
		looseDue,
		loosePast,
		offsetText,
		repeatText,
		taskCount,
		taskLabels
	} from '#lib/tasks.js';

	let { data } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const taskData = provideTaskData(() => data);

	let dialogs: TaskDialogs;
	let ruleDialog: RuleDialog;
	let routineDialog: RoutineDialog;
	let startDialog: RoutineStartDialog;
	let confirmDelete: ConfirmDelete;
	let openRule = $state<string | null>(null);

	const recurring = $derived(
		data.tasks.filter((t) => t.repeatMonths && !t.completedAt && !t.ruleId).toSorted(compareTasks)
	);

	/** Open tasks of each rule, by item. */
	function ruleItems(rule: TaskRule) {
		return data.items
			.filter((item) => item.materialId === rule.materialId && !isRetired(item))
			.map((item) => {
				const open = data.tasks.find(
					(t) => t.ruleId === rule.id && !t.completedAt && t.itemIds.includes(item.id)
				);
				return {
					item,
					name: itemNameOf(taskData.targets.variants, item),
					open,
					last: open ? historyOf(open, taskData.byId)[0] : undefined
				};
			})
			.toSorted((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
	}

	/** The occasions a routine was started for, with the progress of their tasks. */
	function runsOf(routine: TaskRoutine) {
		const runs = Map.groupBy(
			data.tasks.filter((t) => t.routineId === routine.id && t.occasion),
			(t) => t.occasion!
		);
		return [...runs].map(([name, tasks]) => ({
			name,
			done: tasks.filter((t) => t.completedAt).length,
			total: tasks.length
		}));
	}

	function span(routine: TaskRoutine) {
		const offsets = routine.steps.map((s) => s.offsetDays);
		if (offsets.length === 0) return '';
		const [min, max] = [Math.min(...offsets), Math.max(...offsets)];
		return min === max
			? offsetText(min, routine.anchor)
			: `${offsetText(min, routine.anchor)} bis ${offsetText(max, routine.anchor)}`;
	}

	function deleteRule(rule: TaskRule) {
		const open = data.tasks.filter((t) => t.ruleId === rule.id && !t.completedAt).length;
		confirmDelete.show(
			`Regel „${rule.title}“`,
			() =>
				mutate(
					api.DELETE('/task-rules/{id}', { params: { path: { id: rule.id } } }),
					'Regel gelöscht'
				),
			{
				description: `${
					open === 0
						? 'Erledigte Aufgaben bleiben.'
						: open === 1
							? 'Ihre offene Aufgabe wird mitgelöscht, erledigte bleiben.'
							: `Ihre ${open} offenen Aufgaben werden mitgelöscht, erledigte bleiben.`
				} Das kann nicht rückgängig gemacht werden.`
			}
		);
	}

	function deleteRoutine(routine: TaskRoutine) {
		confirmDelete.show(
			`Routine „${routine.name}“`,
			() =>
				mutate(
					api.DELETE('/task-routines/{id}', { params: { path: { id: routine.id } } }),
					'Routine gelöscht'
				),
			{
				description:
					'Aufgaben, die sie angelegt hat, bleiben. Das kann nicht rückgängig gemacht werden.'
			}
		);
	}
</script>

{#snippet header(title: string, hint: string, action: Snippet, count: number)}
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 class="flex items-center gap-1 text-lg font-semibold">
			{title}
			<span class="font-normal text-muted-foreground tabular-nums">({count})</span>
			<InfoHint text={hint} label="Erklärung: {title}" />
		</h2>
		{@render action()}
	</div>
{/snippet}

<div class="space-y-6">
	<div class="space-y-4">
		<a
			href={tenant.href('/tasks')}
			class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />Aufgaben
		</a>
		<h1 class="text-2xl font-bold tracking-tight">Aufgaben verwalten</h1>
	</div>

	<!-- Routines -->
	{#snippet addRoutine()}
		<Button size="sm" variant="outline" onclick={() => routineDialog.show()}>
			<PlusIcon />Routine
		</Button>
	{/snippet}
	<section class="space-y-2">
		{@render header(
			'Routinen',
			'Mehrere Aufgaben auf einmal, mit Terminen rund um einen Tag, z. B. vor jedem Lager.',
			addRoutine,
			data.routines.length
		)}
		{#if data.routines.length === 0}
			<p class="text-sm text-muted-foreground">
				Noch keine Routine, z. B. „Vor dem Lager“: Kocher prüfen, Gasvorrat prüfen, Teilnehmerzahlen
				holen.
			</p>
		{/if}
		<div class="grid gap-3 md:grid-cols-2">
			{#each data.routines as routine (routine.id)}
				{@const runs = runsOf(routine)}
				<div class="flex flex-col gap-3 rounded-md border p-4">
					<div class="flex items-start justify-between gap-2">
						<div>
							<p class="font-medium">{routine.name}</p>
							<p class="text-xs text-muted-foreground">
								{[taskCount(routine.steps.length), span(routine)].filter(Boolean).join(' · ')}
							</p>
						</div>
						<RowActions
							name={routine.name}
							onedit={() => routineDialog.show(routine)}
							actions={[
								{
									label: 'Löschen',
									icon: Trash2Icon,
									destructive: true,
									onselect: () => deleteRoutine(routine)
								}
							]}
						/>
					</div>
					<ul class="space-y-0.5 text-sm text-muted-foreground">
						{#each routine.steps.slice(0, 4) as step, i (i)}
							<li class="truncate">{step.title}</li>
						{/each}
						{#if routine.steps.length > 4}<li>+ {routine.steps.length - 4} weitere</li>{/if}
					</ul>
					{#if runs.length}
						<p class="text-xs text-muted-foreground">
							Gestartet: {runs.map((r) => `${r.name} (${r.done}/${r.total} erledigt)`).join(', ')}
						</p>
					{/if}
					<Button size="sm" class="mt-auto w-fit" onclick={() => startDialog.show(routine)}>
						<PlayIcon />Starten…
					</Button>
				</div>
			{/each}
		</div>
	</section>

	<!-- Rules -->
	{#snippet addRule()}
		<Button size="sm" variant="outline" onclick={() => ruleDialog.show()}><PlusIcon />Regel</Button>
	{/snippet}
	<section class="space-y-2">
		{@render header(
			'Regeln',
			'Eine wiederkehrende Aufgabe für jeden Gegenstand eines Materials, auch für neue, z. B. „Gasschlauch tauschen“ alle 5 Jahre für jeden Gaskocher.',
			addRule,
			data.rules.length
		)}
		{#if data.rules.length === 0}
			<p class="text-sm text-muted-foreground">Noch keine Regel.</p>
		{:else}
			<ul class="divide-y rounded-md border">
				{#each data.rules as rule (rule.id)}
					{@const items = ruleItems(rule)}
					{@const next = items
						.filter((i) => i.open?.dueDate)
						.toSorted((a, b) => a.open!.dueDate!.localeCompare(b.open!.dueDate!))[0]}
					<li>
						<div class="flex items-center gap-2 px-3 py-2.5">
							<button
								type="button"
								class="flex min-w-0 flex-1 items-center gap-2 text-left"
								aria-expanded={openRule === rule.id}
								onclick={() => (openRule = openRule === rule.id ? null : rule.id)}
							>
								<ChevronRightIcon
									class={[
										'size-4 shrink-0 text-muted-foreground transition-transform',
										openRule === rule.id && 'rotate-90'
									]}
								/>
								<div class="min-w-0">
									<p class="font-medium">{rule.title}</p>
									<p class="text-xs text-muted-foreground">
										{[
											`${items.length} × ${taskData.targets.materials.get(rule.materialId)?.name ?? '?'}`,
											repeatText(rule.repeatMonths),
											rule.assigneeName,
											taskLabels[rule.label]
										]
											.filter(Boolean)
											.join(' · ')}
									</p>
								</div>
							</button>
							{#if next}
								<span class="hidden shrink-0 text-right text-xs text-muted-foreground sm:block">
									nächste: {next.name},<br />{looseDue(next.open!.dueDate!)}
								</span>
							{/if}
							<RowActions
								name={rule.title}
								onedit={() => ruleDialog.show(rule)}
								actions={[
									{
										label: 'Löschen',
										icon: Trash2Icon,
										destructive: true,
										onselect: () => deleteRule(rule)
									}
								]}
							/>
						</div>
						{#if openRule === rule.id}
							<ul class="mx-3 mb-3 divide-y rounded-md border text-sm">
								{#each items as { item, name, open, last } (item.id)}
									<li>
										<button
											type="button"
											class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted/50 disabled:hover:bg-transparent"
											onclick={() => open && dialogs.show(open)}
											disabled={!open}
										>
											<span>{name}</span>
											<span class="text-right text-xs text-muted-foreground">
												{#if open?.dueDate}
													<span class={isOverdue(open) ? 'text-destructive' : 'text-foreground'}
														>fällig {looseDue(open.dueDate)}</span
													>
												{:else if !open}
													keine offene Aufgabe
												{/if}
												{#if last}· zuletzt {formatDate(last.completedAt)}{/if}
											</span>
										</button>
									</li>
								{/each}
							</ul>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<!-- Recurring tasks -->
	{#snippet addRecurring()}
		<Button size="sm" variant="outline" onclick={() => dialogs.create({ repeatMonths: 12 })}>
			<PlusIcon />Wiederkehrende Aufgabe
		</Button>
	{/snippet}
	<section class="space-y-2">
		{@render header(
			'Wiederkehrende Aufgaben',
			'Einzelne Aufgaben mit „Wiederholen“. Nach dem Erledigen kommt die nächste.',
			addRecurring,
			recurring.length
		)}
		<ul class="divide-y rounded-md border">
			{#each recurring as task (task.id)}
				{@const last = historyOf(task, taskData.byId)[0]}
				<li>
					<button
						type="button"
						class="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
						onclick={() => dialogs.show(task)}
					>
						<div class="min-w-0 flex-1">
							<p class="font-medium">{task.title}</p>
							<p class="text-xs text-muted-foreground">
								{[
									repeatText(task.repeatMonths!),
									linkNames(task, taskData.targets).join(', '),
									task.assigneeName
								]
									.filter(Boolean)
									.join(' · ')}
							</p>
						</div>
						<div class="shrink-0 text-right text-xs">
							{#if task.dueDate}
								<p
									class={isOverdue(task) ? 'text-destructive' : ''}
									title={formatDate(task.dueDate)}
								>
									{looseDue(task.dueDate)}
								</p>
							{/if}
							<p class="text-muted-foreground">
								{last ? `zuletzt ${loosePast(last.completedAt!)}` : 'noch nie erledigt'}
							</p>
						</div>
					</button>
				</li>
			{:else}
				<li class="px-3 py-6 text-center text-sm text-muted-foreground">
					Keine wiederkehrenden Aufgaben.
				</li>
			{/each}
		</ul>
	</section>
</div>

<TaskDialogs bind:this={dialogs} />
<RuleDialog bind:this={ruleDialog} />
<RoutineDialog bind:this={routineDialog} />
<RoutineStartDialog bind:this={startDialog} />
<ConfirmDelete bind:this={confirmDelete} />
