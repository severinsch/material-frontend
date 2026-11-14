<!-- Starts a routine for an occasion: previews the due dates, then creates its tasks. -->
<script lang="ts">
	import { mutate, type TaskRoutine } from '#lib/api/index.js';
	import { formatDate, today } from '#lib/format.js';
	import { getTenant } from '#lib/tenant.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from '#lib/components/Field.svelte';
	import FormDialog from '#lib/components/FormDialog.svelte';
	import { addDays, offsetText, taskCount } from '#lib/tasks.js';

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let open = $state(false);
	let routine = $state<TaskRoutine | null>(null);
	let occasion = $state('');
	let date = $state('');

	export function show(r: TaskRoutine) {
		routine = r;
		occasion = '';
		date = '';
		open = true;
	}

	const preview = $derived(
		routine?.steps.map((s) => ({ ...s, due: date ? addDays(date, s.offsetDays) : null })) ?? []
	);
	const past = $derived(preview.filter((p) => p.due && p.due < today()).length);
</script>

{#if routine}
	<FormDialog
		bind:open
		title="{routine.name} starten"
		submitLabel="{taskCount(routine.steps.length)} anlegen"
		values={{ occasion, date }}
		class="sm:max-w-lg"
		onsubmit={() =>
			mutate(
				api.POST('/task-routines/{id}/start', {
					params: { path: { id: routine!.id } },
					body: { occasion, anchorDate: date }
				}),
				(tasks) => `${taskCount(tasks.length)} für „${occasion.trim()}“ angelegt`
			)}
	>
		<div class="grid gap-4 sm:grid-cols-2">
			<Field label="Anlass" id="run-name">
				<Input
					id="run-name"
					bind:value={occasion}
					required
					maxlength={100}
					placeholder="z. B. Pfingstlager 2027"
				/>
			</Field>
			<Field label={routine.anchor} id="run-date">
				<Input id="run-date" type="date" required bind:value={date} />
			</Field>
		</div>
		<ul class="divide-y rounded-md border text-sm">
			{#each preview as p, i (i)}
				<li class="flex items-start justify-between gap-3 px-3 py-2">
					<div class="min-w-0">
						<p class="font-medium">{p.title}</p>
						{#if p.assigneeName}<p class="text-xs text-muted-foreground">{p.assigneeName}</p>{/if}
					</div>
					<span
						class={[
							'shrink-0 text-right text-muted-foreground tabular-nums',
							p.due && p.due < today() && 'text-destructive'
						]}
					>
						{p.due ? formatDate(p.due) : offsetText(p.offsetDays, routine.anchor)}
					</span>
				</li>
			{/each}
		</ul>
		{#if past > 0}
			<p class="text-sm text-muted-foreground">
				{past === 1 ? 'Eine Aufgabe ist' : `${past} Aufgaben sind`} damit schon überfällig.
			</p>
		{/if}
	</FormDialog>
{/if}
