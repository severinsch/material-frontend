<script lang="ts">
	import { mutate, type Kit, type Material } from '#lib/api/index.js';
	import { variantName, variantsError as variantNamesError } from '#lib/format.js';
	import { kitsAfterMerge, suggestMerge } from '#lib/merge.js';
	import { getTenant } from '#lib/tenant.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	/** [kits] are the tenant's kits, to show which of them use the materials. */
	let { kits }: { kits: Kit[] } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let open = $state(false);
	/** The materials in the order they were selected. */
	let selected = $state<Material[]>([]);
	let targetId = $state('');
	let name = $state('');
	/** The suggested name, replaced when the target changes unless it was edited. */
	let suggestedName = $state('');
	/** The new name of every variant, by variant id. */
	let variantNames = $state<Record<string, string>>({});
	/** Validation errors are only shown after the first attempt to merge. */
	let submitted = $state(false);

	/** The target first, which keeps its id, category and description; the others in the order selected. */
	const materials = $derived([
		...selected.filter((material) => material.id === targetId),
		...selected.filter((material) => material.id !== targetId)
	]);
	const target = $derived(materials[0]);

	/** One row per variant, labeled with its current name, e.g. "Seil 10 m" or "Kanister 20 L". */
	const rows = $derived(
		materials.flatMap((material) =>
			material.variants.map((variant) => ({
				id: variant.id,
				current: variantName(material, variant)
			}))
		)
	);

	const variantsError = $derived(variantNamesError(rows.map((row) => variantNames[row.id] ?? '')));

	/** The variant names as the merged material will list them. */
	const preview = $derived(
		rows
			.map((row) => variantNames[row.id]?.trim() || '…')
			.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
			.join(', ')
	);

	const usedIn = $derived(kitsAfterMerge(kits, materials));

	/** E.g. "Jurte", "Jurte und Kohte", "Jurte, Kohte und Lager". */
	function enumerate(names: string[]): string {
		return names.length < 2
			? names.join('')
			: `${names.slice(0, -1).join(', ')} und ${names[names.length - 1]}`;
	}

	/** Opens the dialog for [materials] (at least two of the same tracking type), the first as the target. */
	export function show(toMerge: Material[]) {
		selected = toMerge;
		targetId = toMerge[0].id;
		const suggestion = suggestMerge(toMerge);
		name = suggestedName = suggestion.name;
		variantNames = Object.fromEntries(suggestion.variantNames);
		submitted = false;
		open = true;
	}

	function setTarget(id: string) {
		targetId = id;
		// Without a common start of the names, the suggestion is the target's name.
		const suggestion = suggestMerge(materials).name;
		if (name === suggestedName) name = suggestion;
		suggestedName = suggestion;
	}

	async function merge() {
		submitted = true;
		if (variantsError || usedIn.blocked.length > 0) return false;
		const merged = name.trim();
		return mutate(
			api.POST('/materials/merge', {
				body: {
					materialIds: materials.map((material) => material.id),
					name: merged,
					variantNames: Object.fromEntries(rows.map((row) => [row.id, variantNames[row.id].trim()]))
				}
			}),
			`${merged} zusammengeführt`,
			{ redirectTo: (material) => tenant.href(`/materials/${material.id}`) }
		);
	}
</script>

<FormDialog
	bind:open
	title="Materialien zusammenführen"
	description="Die Materialien werden zu Varianten eines Materials, z. B. Seil mit 10 m, 15 m und 20 m. Bestand, Gegenstände, Einkäufe und Ausleihen bleiben bei ihrer Variante."
	submitLabel="Zusammenführen"
	submitDisabled={usedIn.blocked.length > 0}
	class="sm:max-w-lg"
	onsubmit={merge}
>
	<Field label="Name" id="merge-name">
		<Input id="merge-name" bind:value={name} required maxlength={255} />
	</Field>
	<div class="grid gap-2">
		<Field label="Kategorie und Beschreibung übernehmen von" id="merge-target">
			<SelectField
				id="merge-target"
				bind:value={() => targetId, setTarget}
				options={selected.map((material) => ({ value: material.id, label: material.name }))}
			/>
		</Field>
		<p class="text-sm text-muted-foreground">
			{#if target?.category || target?.description}
				{[
					target.category && `Kategorie: ${target.category}`,
					target.description && `Beschreibung: ${target.description}`
				]
					.filter(Boolean)
					.join(' · ')}.
			{/if}
			Die anderen Materialien werden gelöscht.
		</p>
	</div>

	<fieldset class="grid gap-3" aria-describedby="merge-variants-hint">
		<legend class="mb-1 text-sm font-medium">Varianten</legend>
		<p id="merge-variants-hint" class="text-sm text-muted-foreground">
			Jede Variante braucht einen eigenen Namen, z. B. „15 m“.
		</p>
		<div
			class="hidden gap-3 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-2"
			aria-hidden="true"
		>
			<span>Bisher</span><span>Name der Variante</span>
		</div>
		{#each rows as row (row.id)}
			<div class="grid gap-1 sm:grid-cols-2 sm:items-center sm:gap-3">
				<Label for="merge-variant-{row.id}" class="font-normal">
					<span class="sr-only">Name der Variante für</span>{row.current}
				</Label>
				<Input
					id="merge-variant-{row.id}"
					bind:value={variantNames[row.id]}
					required
					maxlength={100}
					aria-invalid={(submitted && !!variantsError && !variantNames[row.id]?.trim()) ||
						undefined}
					aria-describedby={submitted && variantsError ? 'merge-variants-error' : undefined}
				/>
			</div>
		{/each}
		{#if submitted && variantsError}
			<p id="merge-variants-error" class="text-sm text-destructive">{variantsError}</p>
		{/if}
	</fieldset>

	<div class="grid gap-1 rounded-md border bg-muted/30 p-3 text-sm">
		<p>
			<span class="text-muted-foreground">Ergebnis:</span>
			<span class="font-medium">{name.trim() || '…'}</span>: {preview}
		</p>
		{#if usedIn.same.length > 0}
			<p class="text-muted-foreground">
				Verwendet {usedIn.same.length === 1 ? 'im Set' : 'in den Sets'}
				{enumerate(usedIn.same)}. {usedIn.same.length === 1 ? 'Es verwendet' : 'Sie verwenden'} danach
				genau dieselben Varianten wie bisher.
			</p>
		{/if}
		{#if usedIn.widened.length > 0}
			<p class="text-muted-foreground">
				{usedIn.widened.length === 1 ? 'Im Set' : 'In den Sets'}
				{enumerate(usedIn.widened)} steht „{target.name} (beliebige Variante)“; dort passen danach auch
				die neuen Varianten.
			</p>
		{/if}
		<p class="text-muted-foreground">Das Zusammenführen lässt sich nicht rückgängig machen.</p>
	</div>
	{#if usedIn.blocked.length > 0}
		<Alert.Root variant="destructive">
			<Alert.Title>Zusammenführen nicht möglich</Alert.Title>
			<Alert.Description>
				{#each usedIn.blocked as message (message)}
					<p>{message}</p>
				{/each}
			</Alert.Description>
		</Alert.Root>
	{/if}
</FormDialog>
