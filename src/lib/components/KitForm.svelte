<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { mutate, type Kit, type Material, type NewKit } from '#lib/api/index.js';
	import { orNull } from '#lib/format.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import ConfirmDelete from './ConfirmDelete.svelte';
	import Field from './Field.svelte';
	import MaterialPicker from './MaterialPicker.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let { kit, materials }: { kit?: Kit; materials: Material[] } = $props();

	// The form is created once per kit; the page re-creates this component when navigating to another kit.
	// svelte-ignore state_referenced_locally
	const form = $state({
		name: kit?.name ?? '',
		description: kit?.description ?? '',
		groups: (kit?.groups ?? []).map((group) => ({
			name: group.name ?? '',
			requiredUnits: group.requiredUnits,
			isOptional: group.isOptional,
			// Alternatives are kept in priority order, the first one is used first.
			options: group.options
				.toSorted((a, b) => a.priority - b.priority)
				.map(({ materialId, unitValue }) => ({ materialId, unitValue }))
		}))
	});
	let saving = $state(false);
	/** Validation errors are only shown after the first attempt to save. */
	let submitted = $state(false);
	let confirmDelete: ConfirmDelete;

	type Group = (typeof form.groups)[number];

	/** The validation error of a group's alternatives, if any. */
	function groupError(group: Group): string | undefined {
		if (group.options.some((option) => !option.materialId)) {
			return 'Wähle für jede Alternative ein Material.';
		}
		const ids = group.options.map((option) => option.materialId);
		if (new Set(ids).size < ids.length) return 'Jedes Material kann pro Teil nur einmal vorkommen.';
	}

	const noParts = $derived(form.groups.length === 0);
	const isValid = $derived(!noParts && form.groups.every((group) => !groupError(group)));

	function newOption() {
		return { materialId: '', unitValue: 1 };
	}

	function moveUp<T>(list: T[], index: number) {
		[list[index - 1], list[index]] = [list[index], list[index - 1]];
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		submitted = true;
		if (!isValid) return;
		const body: NewKit = {
			name: form.name,
			description: orNull(form.description),
			groups: form.groups.map((group) => ({
				...group,
				name: orNull(group.name),
				options: group.options.map((option, priority) => ({ ...option, priority }))
			}))
		};
		saving = true;
		const request = kit
			? api.PUT('/kits/{id}', { params: { path: { id: kit.id } }, body })
			: api.POST('/kits', { body });
		await mutate(request, `${form.name} gespeichert`, { redirectTo: tenant.href('/kits') });
		saving = false;
	}

	function remove(kit: Kit) {
		confirmDelete.show(`Set „${kit.name}“`, () =>
			mutate(
				api.DELETE('/kits/{id}', { params: { path: { id: kit.id } } }),
				`${kit.name} gelöscht`,
				{ redirectTo: tenant.href('/kits') }
			)
		);
	}
</script>

<form onsubmit={save} class="max-w-3xl space-y-6">
	<div class="grid gap-4">
		<Field label="Name" id="kit-name">
			<Input
				id="kit-name"
				bind:value={form.name}
				required
				maxlength={255}
				placeholder="z. B. Jurte"
			/>
		</Field>
		<Field label="Beschreibung" id="kit-description">
			<Input id="kit-description" bind:value={form.description} />
		</Field>
	</div>

	<div class="space-y-2">
		<h2 class="text-lg font-semibold">Teile</h2>
		<p class="text-sm text-muted-foreground">
			Jedes Teil braucht eine Anzahl Einheiten, die von einem oder mehreren austauschbaren
			Materialien gefüllt werden. Die Alternativen werden in der angegebenen Reihenfolge verwendet;
			ein Material kann mehrere Einheiten zählen (z. B. ersetzt ein Jurtenhalbdach drei
			Kohtenblätter). Optionale Teile werden ganz oder gar nicht eingepackt.
		</p>
	</div>

	{#each form.groups as group, g (group)}
		{@const error = submitted ? groupError(group) : undefined}
		{@const partName = group.name || `Teil ${g + 1}`}
		<Card.Root>
			<Card.Content class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
					<Field label="Name (optional)" id="group-{g}-name">
						<Input id="group-{g}-name" bind:value={group.name} placeholder="z. B. Dach" />
					</Field>
					<Field label="Einheiten" id="group-{g}-units">
						<Input
							id="group-{g}-units"
							type="number"
							min={1}
							required
							bind:value={group.requiredUnits}
						/>
					</Field>
					<div class="flex h-9 items-center gap-2">
						<Checkbox id="group-{g}-optional" bind:checked={group.isOptional} />
						<Label for="group-{g}-optional">Optional</Label>
					</div>
				</div>

				<div class="space-y-2">
					<div class="flex items-end gap-2 text-sm font-medium">
						<span class="flex-1">
							{#if group.options.length > 1}
								Alternativen <span class="font-normal text-muted-foreground"
									>(die erste wird bevorzugt)</span
								>
							{:else}
								Material
							{/if}
						</span>
						<span class="w-20 text-xs leading-tight">Einheiten pro Stück</span>
						<!-- Space above the two buttons of each row. -->
						<span class="w-16 pointer-coarse:w-24"></span>
					</div>
					{#each group.options as option, o (option)}
						{@const optionName = `Alternative ${o + 1} von ${partName}`}
						<div class="flex items-center gap-2">
							<div class="min-w-0 flex-1">
								<MaterialPicker
									bind:value={option.materialId}
									{materials}
									aria-label="Material für {optionName}"
									aria-describedby={error ? `group-${g}-error` : undefined}
									invalid={submitted && !option.materialId}
								/>
							</div>
							<Input
								type="number"
								min={1}
								required
								class="w-20"
								aria-label="Einheiten pro Stück für {optionName}"
								bind:value={option.unitValue}
							/>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="{optionName} früher verwenden"
								title="Früher verwenden"
								disabled={o === 0}
								onclick={() => moveUp(group.options, o)}
							>
								<ArrowUpIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="{optionName} entfernen"
								title="Entfernen"
								disabled={group.options.length === 1}
								onclick={() => group.options.splice(o, 1)}
							>
								<XIcon />
							</Button>
						</div>
					{/each}
					{#if error}
						<p id="group-{g}-error" class="text-sm text-destructive">{error}</p>
					{/if}
				</div>
			</Card.Content>
			<Card.Footer class="flex-wrap justify-between gap-2">
				<Button variant="outline" size="sm" onclick={() => group.options.push(newOption())}>
					<PlusIcon />Alternative hinzufügen
				</Button>
				<div class="flex gap-1">
					<Button
						variant="ghost"
						size="sm"
						aria-label="{partName} nach oben"
						disabled={g === 0}
						onclick={() => moveUp(form.groups, g)}
					>
						<ArrowUpIcon />Nach oben
					</Button>
					<Button
						variant="ghost"
						size="sm"
						aria-label="{partName} entfernen"
						onclick={() => form.groups.splice(g, 1)}
					>
						<XIcon />Teil entfernen
					</Button>
				</div>
			</Card.Footer>
		</Card.Root>
	{/each}

	<div class="space-y-2">
		<Button
			variant="outline"
			aria-describedby={submitted && noParts ? 'kit-parts-error' : undefined}
			onclick={() =>
				form.groups.push({ name: '', requiredUnits: 1, isOptional: false, options: [newOption()] })}
		>
			<PlusIcon />Teil hinzufügen
		</Button>
		{#if submitted && noParts}
			<p id="kit-parts-error" class="text-sm text-destructive">
				Ein Set braucht mindestens ein Teil.
			</p>
		{/if}
	</div>

	<div class="flex flex-wrap justify-between gap-2 border-t pt-4">
		<div class="flex gap-2">
			<Button type="submit" disabled={saving}>Set speichern</Button>
			<Button variant="outline" href={tenant.href('/kits')}>Abbrechen</Button>
		</div>
		{#if kit}
			<Button variant="destructive" onclick={() => remove(kit)}>Set löschen</Button>
		{/if}
	</div>
</form>

<ConfirmDelete bind:this={confirmDelete} />
