<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Settings2Icon from '@lucide/svelte/icons/settings-2';
	import type { Task, TaskLabel } from '#lib/api/index.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import SelectField from '#lib/components/SelectField.svelte';
	import { provideTaskData } from '#lib/components/tasks/context.svelte.js';
	import TaskDialogs from '#lib/components/tasks/TaskDialogs.svelte';
	import TaskList from '#lib/components/tasks/TaskList.svelte';
	import { grouped, labelOptions, linkNames, taskLabels } from '#lib/tasks.js';

	let { data } = $props();

	const tenant = getTenant();
	const canEdit = $derived(tenant.can('EDIT'));
	const taskData = provideTaskData(() => data);

	let dialogs: TaskDialogs;

	let search = $state('');
	let assignee = $state('all');
	/** Selected labels; none selected means all. */
	let selectedLabels = $state<TaskLabel[]>([]);
	let showDone = $state(false);

	const assigneeOptions = $derived([
		{ value: 'all', label: 'Alle' },
		{ value: tenant.user.id, label: 'Meine' },
		...data.members
			.filter((m) => m.userId !== tenant.user.id)
			.map((m) => ({ value: m.userId, label: m.displayName })),
		{ value: 'none', label: 'Niemand zugewiesen' }
	]);

	const labelSummary = $derived(
		selectedLabels.length === 0
			? 'Alle Arten'
			: selectedLabels.length <= 2
				? selectedLabels.map((l) => taskLabels[l]).join(', ')
				: `${selectedLabels.length} Arten`
	);

	function matches(task: Task) {
		const q = search.trim().toLowerCase();
		if (
			q &&
			![
				task.title,
				task.note ?? '',
				task.occasion ?? '',
				...linkNames(task, taskData.targets)
			].some((s) => s.toLowerCase().includes(q))
		)
			return false;
		if (assignee === 'none' && task.assigneeId) return false;
		if (assignee !== 'all' && assignee !== 'none' && task.assigneeId !== assignee) return false;
		if (selectedLabels.length && !selectedLabels.includes(task.label)) return false;
		return true;
	}

	const open = $derived(data.tasks.filter((t) => !t.completedAt && matches(t)));
	const groups = $derived(grouped(open));
	const done = $derived(
		data.tasks
			.filter((t) => t.completedAt && matches(t))
			.toSorted((a, b) => b.completedAt!.localeCompare(a.completedAt!))
	);
	const filtered = $derived(
		search.trim() !== '' || assignee !== 'all' || selectedLabels.length > 0
	);
</script>

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-2xl font-bold tracking-tight">Aufgaben</h1>
		{#if canEdit}
			<div class="flex gap-2">
				<Button variant="outline" href={tenant.href('/tasks/manage')}>
					<!-- Just the icon on phones, still named for screen readers. -->
					<Settings2Icon /><span class="sr-only sm:not-sr-only">Verwalten</span>
				</Button>
				<Button onclick={() => dialogs.create()}><PlusIcon />Neue Aufgabe</Button>
			</div>
		{/if}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<div class="relative w-full sm:w-56">
			<SearchIcon class="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input bind:value={search} placeholder="Suchen…" class="pl-8" aria-label="Aufgaben suchen" />
		</div>
		<div class="w-[calc(50%-0.25rem)] sm:w-44">
			<SelectField bind:value={assignee} options={assigneeOptions} label="Zuständig" />
		</div>
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="outline"
						class="w-[calc(50%-0.25rem)] justify-between font-normal sm:w-44"
					>
						<span class="truncate">{labelSummary}</span><ChevronDownIcon class="opacity-50" />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="start" class="w-48">
				{#each labelOptions as { value, label } (value)}
					<DropdownMenu.CheckboxItem
						closeOnSelect={false}
						checked={selectedLabels.includes(value)}
						onCheckedChange={(on) =>
							(selectedLabels = on
								? [...selectedLabels, value]
								: selectedLabels.filter((l) => l !== value))}
					>
						{label}
					</DropdownMenu.CheckboxItem>
				{/each}
				{#if selectedLabels.length}
					<DropdownMenu.Separator />
					<DropdownMenu.Item onSelect={() => (selectedLabels = [])}>Alle zeigen</DropdownMenu.Item>
				{/if}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
		<label class="flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
			<Switch bind:checked={showDone} />Erledigte
		</label>
	</div>

	{#if groups.length === 0}
		<p class="py-10 text-center text-muted-foreground">
			{filtered ? 'Keine passenden Aufgaben.' : 'Nichts zu tun.'}
		</p>
	{:else}
		<TaskList {groups} onopen={(t) => dialogs.show(t)} oncheck={(t) => dialogs.check(t)} />
	{/if}

	{#if showDone}
		<section>
			<h2 class="mb-1 px-1 text-sm font-semibold text-muted-foreground">
				Erledigt <span class="font-normal tabular-nums">({done.length})</span>
			</h2>
			{#if done.length === 0}
				<p class="py-6 text-center text-sm text-muted-foreground">Noch nichts erledigt.</p>
			{:else}
				<TaskList
					groups={[{ group: null, tasks: done }]}
					onopen={(t) => dialogs.show(t)}
					oncheck={(t) => dialogs.check(t)}
				/>
			{/if}
		</section>
	{/if}
</div>

<TaskDialogs bind:this={dialogs} />
