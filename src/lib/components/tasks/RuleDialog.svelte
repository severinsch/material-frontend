<!-- Create or edit a rule: one recurring task for every item of an individually tracked material. -->
<script lang="ts">
	import { mutate, type TaskLabel, type TaskRule } from '#lib/api/index.js';
	import { formatDate, itemNameOf, today } from '#lib/format.js';
	import { isRetired } from '#lib/items.js';
	import { getTenant } from '#lib/tenant.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as RadioGroup from '#lib/components/ui/radio-group/index.js';
	import Field from '#lib/components/Field.svelte';
	import FormDialog from '#lib/components/FormDialog.svelte';
	import SelectField from '#lib/components/SelectField.svelte';
	import {
		addMonths,
		assigneeOptions,
		countOf,
		durationText,
		intervalOf,
		intervalUnits,
		labelOptions,
		looseDue,
		monthsOf
	} from '#lib/tasks.js';
	import { getTaskData } from './context.svelte.js';
	import NoteEditor from './NoteEditor.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const data = getTaskData();

	let open = $state(false);
	let id = $state<string | null>(null);
	let opened = $state(0);
	let form = $state(formOf());
	let interval = $state(intervalOf(12));
	/** Validation errors are only shown after the first attempt to save. */
	let submitted = $state(false);
	const materialMissing = $derived(!form.materialId);

	function formOf(rule?: TaskRule) {
		return {
			title: rule?.title ?? '',
			materialId: rule?.materialId ?? '',
			fromPurchase: rule?.fromPurchase ?? true,
			assigneeId: rule?.assigneeId ?? '',
			label: rule?.label ?? ('INSPECTION' as TaskLabel),
			note: rule?.note ?? ''
		};
	}

	export function show(rule?: TaskRule) {
		id = rule?.id ?? null;
		form = formOf(rule);
		interval = intervalOf(rule?.repeatMonths ?? 12);
		submitted = false;
		opened++;
		open = true;
	}

	const repeatMonths = $derived(monthsOf(interval));

	const materialOptions = $derived(
		data.materials
			.filter((m) => m.trackingType === 'INDIVIDUAL' && (!m.archivedAt || m.id === form.materialId))
			.toSorted((a, b) => a.name.localeCompare(b.name, 'de'))
			.map((m) => ({ value: m.id, label: m.name }))
	);
	const memberOptions = $derived(assigneeOptions(data.members));

	/**
	 * For a new rule: the tasks it creates, one per item that isn't retired, due [repeatMonths] after the purchase
	 * (if wanted and known) or after today, as the server does. Editing a rule changes no existing task and creates none,
	 * so there is nothing to preview then.
	 */
	const preview = $derived.by(() => {
		if (id || !form.materialId) return [];
		const now = today();
		return data.items
			.filter((item) => item.materialId === form.materialId && !isRetired(item))
			.map((item) => {
				const fromPurchase = form.fromPurchase && !!item.purchaseDate;
				return {
					id: item.id,
					name: itemNameOf(data.targets.variants, item),
					due: addMonths(fromPurchase ? item.purchaseDate! : now, repeatMonths),
					fromPurchase
				};
			})
			.toSorted((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
	});

	async function save() {
		submitted = true;
		if (materialMissing) return false;
		const body = {
			...form,
			repeatMonths,
			assigneeId: form.assigneeId || null,
			note: form.note.trim() ? form.note : null
		};
		return id
			? mutate(api.PUT('/task-rules/{id}', { params: { path: { id } }, body }), 'Regel gespeichert')
			: mutate(api.POST('/task-rules', { body }), 'Regel angelegt');
	}
</script>

<FormDialog
	bind:open
	title={id ? 'Regel bearbeiten' : 'Neue Regel'}
	description="Eine wiederkehrende Aufgabe für jeden Gegenstand eines Materials, auch für später hinzukommende."
	submitLabel={id ? 'Speichern' : 'Anlegen'}
	values={{ form, interval }}
	class="sm:max-w-lg"
	onsubmit={save}
>
	<Field label="Aufgabe" id="rule-title">
		<Input
			id="rule-title"
			bind:value={form.title}
			required
			maxlength={255}
			placeholder="z. B. Gasschlauch tauschen"
		/>
	</Field>
	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Für jeden Gegenstand von" id="rule-material">
			{#if id}
				<!-- Its tasks belong to the material's items, so the material stays. -->
				<p class="flex h-9 items-center text-sm">
					{data.targets.materials.get(form.materialId)?.name ?? 'Unbekanntes Material'}
				</p>
			{:else}
				<SelectField
					id="rule-material"
					bind:value={form.materialId}
					options={materialOptions}
					placeholder="Material wählen…"
					invalid={submitted && materialMissing}
					describedby={submitted && materialMissing ? 'rule-material-error' : undefined}
				/>
				{#if submitted && materialMissing}
					<p id="rule-material-error" class="text-sm text-destructive">Wähle ein Material aus.</p>
				{/if}
			{/if}
		</Field>
		<Field label="Wiederholen alle" id="rule-n">
			<div class="flex gap-2">
				<!-- An empty field keeps the interval (shown again on leaving it). -->
				<Input
					id="rule-n"
					type="number"
					min="1"
					class="w-20 shrink-0"
					value={interval.n}
					oninput={(e) => (interval.n = countOf(e.currentTarget.valueAsNumber) ?? interval.n)}
					onblur={(e) => (e.currentTarget.value = String(interval.n))}
				/>
				<SelectField bind:value={interval.unit} options={intervalUnits} label="Einheit" />
			</div>
		</Field>
	</div>
	<div class="grid gap-3">
		<p id="rule-first" class="text-sm font-medium">Erste Fälligkeit</p>
		<RadioGroup.Root
			aria-labelledby="rule-first"
			bind:value={() => String(form.fromPurchase), (v) => (form.fromPurchase = v === 'true')}
		>
			<div class="flex items-center gap-2">
				<RadioGroup.Item value="true" id="rule-from-purchase" />
				<Label for="rule-from-purchase" class="font-normal">
					{durationText(repeatMonths)} nach dem Kauf (ohne Kaufdatum: ab heute)
				</Label>
			</div>
			<div class="flex items-center gap-2">
				<RadioGroup.Item value="false" id="rule-from-today" />
				<Label for="rule-from-today" class="font-normal"
					>{durationText(repeatMonths)} ab heute</Label
				>
			</div>
		</RadioGroup.Root>
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<Field label="Zuständig" id="rule-assignee">
			<SelectField id="rule-assignee" bind:value={form.assigneeId} options={memberOptions} />
		</Field>
		<Field label="Art" id="rule-label">
			<SelectField id="rule-label" bind:value={form.label} options={labelOptions} />
		</Field>
	</div>
	<Field label="Notiz für jede Aufgabe" id="rule-note">
		{#key opened}<NoteEditor id="rule-note" bind:note={form.note} />{/key}
	</Field>

	{#if id}
		<p class="text-sm text-muted-foreground">
			Änderungen gelten für Aufgaben, die ab jetzt entstehen; offene Aufgaben bleiben, wie sie sind.
		</p>
	{:else if preview.length > 0}
		<div class="grid gap-1 rounded-md border p-3 text-sm">
			<p class="mb-1 font-medium">Wird angelegt</p>
			{#each preview as p (p.id)}
				<div class="flex justify-between gap-2">
					<span>{p.name}</span>
					<span class="text-muted-foreground" title={formatDate(p.due)}>
						{looseDue(p.due)}{p.fromPurchase ? ' (ab Kauf)' : ''}
					</span>
				</div>
			{/each}
			<p class="mt-1 text-xs text-muted-foreground">
				Fälligkeiten einzelner Gegenstände lassen sich danach in der Aufgabe ändern.
			</p>
		</div>
	{/if}
</FormDialog>
