<!-- Create or edit a routine: its tasks on a time line around day 0, the selected one's fields below. -->
<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { mutate, type NewRoutineStep, type TaskRoutine } from '#lib/api/index.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from '#lib/components/Field.svelte';
	import FormDialog from '#lib/components/FormDialog.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import { assigneeOptions, countOf, labelOptions } from '#lib/tasks.js';
	import { getTaskData } from './context.svelte.js';
	import NoteEditor from './NoteEditor.svelte';
	import RoutineTimeline from './RoutineTimeline.svelte';
	import TaskLinkPicker from './TaskLinkPicker.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const data = getTaskData();

	type Step = Required<Omit<NewRoutineStep, 'note' | 'assigneeId'>> &
		Pick<NewRoutineStep, 'note' | 'assigneeId'>;

	let open = $state(false);
	let id = $state<string | null>(null);
	let form = $state({ name: '', anchor: 'Lagerbeginn', steps: [] as Step[] });
	/** Index of the step whose fields are shown below the time line. */
	let selected = $state<number | null>(null);
	/** Validation errors are only shown after the first attempt to save. */
	let submitted = $state(false);

	const untitled = (s: Step) => !s.title.trim();
	const stepsError = $derived(
		form.steps.length === 0
			? 'Eine Routine braucht mindestens eine Aufgabe.'
			: form.steps.some(untitled)
				? 'Jede Aufgabe braucht einen Titel.'
				: null
	);

	export function show(routine?: TaskRoutine) {
		id = routine?.id ?? null;
		form = {
			name: routine?.name ?? '',
			anchor: routine?.anchor ?? 'Lagerbeginn',
			steps:
				routine?.steps.map((s) => ({
					offsetDays: s.offsetDays,
					title: s.title,
					note: s.note ?? '',
					assigneeId: s.assigneeId ?? null,
					label: s.label,
					urgent: s.urgent,
					materialIds: s.materialIds,
					itemIds: s.itemIds
				})) ?? []
		};
		selected = null;
		submitted = false;
		open = true;
	}

	const memberOptions = $derived(assigneeOptions(data.members));
	const whenOptions = [
		{ value: 'before', label: 'vorher' },
		{ value: 'on', label: 'am Tag' },
		{ value: 'after', label: 'danach' }
	];

	const whenOf = (s: Step) => (s.offsetDays < 0 ? 'before' : s.offsetDays > 0 ? 'after' : 'on');

	function setWhen(s: Step, when: string) {
		// The select may write an empty value while mounting; that must not reset the offset.
		if (when === whenOf(s) || !['before', 'on', 'after'].includes(when)) return;
		const n = Math.abs(s.offsetDays) || 1;
		s.offsetDays = when === 'before' ? -n : when === 'after' ? n : 0;
	}

	/** Sets the days before or after day 0 from the "Tage" field, ignoring what isn't a day count (e.g. empty). */
	function setDays(s: Step, input: HTMLInputElement) {
		const days = countOf(input.valueAsNumber, 365);
		if (days) s.offsetDays = whenOf(s) === 'before' ? -days : days;
	}

	function addStep() {
		form.steps.push({
			offsetDays: form.steps.at(-1)?.offsetDays ?? -7,
			title: '',
			note: '',
			assigneeId: null,
			label: 'OTHER',
			urgent: false,
			materialIds: [],
			itemIds: []
		});
		selected = form.steps.length - 1;
	}

	function removeStep(index: number) {
		form.steps.splice(index, 1);
		selected = null;
	}

	async function save() {
		submitted = true;
		if (stepsError) {
			// Shows the first untitled step's fields.
			const index = form.steps.findIndex(untitled);
			if (index >= 0) selected = index;
			return false;
		}
		const body = {
			name: form.name,
			anchor: form.anchor,
			steps: form.steps.map((s) => ({ ...s, note: s.note?.trim() ? s.note : null }))
		};
		return id
			? mutate(
					api.PUT('/task-routines/{id}', { params: { path: { id } }, body }),
					'Routine gespeichert'
				)
			: mutate(api.POST('/task-routines', { body }), (r) => `Routine „${r.name}“ angelegt`);
	}
</script>

<FormDialog
	bind:open
	title={id ? 'Routine bearbeiten' : 'Neue Routine'}
	submitLabel={id ? 'Speichern' : 'Anlegen'}
	values={form}
	class="sm:max-w-2xl"
	onsubmit={save}
>
	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Name" id="routine-name">
			<Input
				id="routine-name"
				bind:value={form.name}
				required
				maxlength={100}
				placeholder="z. B. Vor dem Lager"
			/>
		</Field>
		<Field label="Name von Tag 0" id="routine-anchor">
			<Input
				id="routine-anchor"
				bind:value={form.anchor}
				required
				maxlength={100}
				placeholder="z. B. Lagerbeginn"
			/>
		</Field>
	</div>

	<div class="grid gap-2">
		<div class="flex items-center justify-between gap-2">
			<p class="text-sm font-medium">Aufgaben</p>
			<p class="text-xs text-muted-foreground">Ziehen verschiebt den Tag, Klick bearbeitet.</p>
		</div>
		<RoutineTimeline
			steps={form.steps}
			anchor={form.anchor}
			markUntitled={submitted}
			bind:selected
		/>
		{#if submitted && stepsError}
			<p class="text-sm text-destructive">{stepsError}</p>
		{/if}
		<Button type="button" variant="outline" size="sm" class="w-fit" onclick={addStep}>
			<PlusIcon />Aufgabe hinzufügen
		</Button>
	</div>

	{#if selected != null && form.steps[selected]}
		{@const s = form.steps[selected]}
		{#key selected}
			<!-- Scrolled into view when a step is selected, which may be far up the time line. -->
			<div
				class="grid gap-3 rounded-md border border-primary/40 p-3"
				{@attach (fields) => fields.scrollIntoView({ block: 'nearest' })}
			>
				<Input
					bind:value={s.title}
					placeholder="Aufgabe"
					aria-label="Aufgabe"
					maxlength={255}
					aria-invalid={(submitted && untitled(s)) || undefined}
				/>
				<div class="flex flex-wrap items-center gap-3">
					<div class="flex items-center gap-1">
						{#if s.offsetDays !== 0}
							<Input
								type="number"
								min="1"
								max="365"
								class="h-8 w-20 shrink-0"
								aria-label="Tage"
								value={Math.abs(s.offsetDays)}
								oninput={(e) => setDays(s, e.currentTarget)}
								onblur={(e) => (e.currentTarget.value = String(Math.abs(s.offsetDays)))}
							/>
							<span class="text-sm text-muted-foreground">Tage</span>
						{/if}
						<SelectField
							bind:value={() => whenOf(s), (v) => setWhen(s, v)}
							options={whenOptions}
							label="Wann"
						/>
					</div>
					{#if data.members.length > 0}
						<div class="w-40">
							<SelectField
								bind:value={() => s.assigneeId ?? '', (v) => (s.assigneeId = v || null)}
								options={memberOptions}
								label="Zuständig"
							/>
						</div>
					{/if}
					<label class="flex items-center gap-2 text-sm">
						<Checkbox bind:checked={s.urgent} />Dringend
					</label>
				</div>
				<div class="grid gap-3 sm:grid-cols-2">
					<Field label="Art" id="step-label">
						<SelectField id="step-label" bind:value={s.label} options={labelOptions} />
					</Field>
					<Field label="Betrifft" id="step-links">
						<TaskLinkPicker
							id="step-links"
							bind:materialIds={s.materialIds}
							bind:itemIds={s.itemIds}
						/>
					</Field>
				</div>
				<Field label="Notiz" id="step-note">
					<NoteEditor id="step-note" bind:note={() => s.note ?? '', (v) => (s.note = v)} />
				</Field>
				<div class="flex justify-between">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						class="text-destructive"
						onclick={() => removeStep(selected!)}>Entfernen</Button
					>
					<Button type="button" variant="outline" size="sm" onclick={() => (selected = null)}
						>Fertig</Button
					>
				</div>
			</div>
		{/key}
	{/if}
</FormDialog>
