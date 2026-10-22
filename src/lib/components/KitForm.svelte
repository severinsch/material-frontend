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
			// The first amount is the default in the packing list; a single amount has no label.
			amounts: group.amounts.map(({ label, requiredUnits }) => ({
				label: label ?? '',
				requiredUnits
			})),
			// Alternatives are kept in priority order, the first one is used first.
			options: group.options
				.toSorted((a, b) => a.priority - b.priority)
				.map(({ materialId, variantId, unitValue }) => ({
					materialId,
					variantId: variantId ?? null,
					unitValue
				}))
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
		// As in the API: "any variant" covers the specific ones, so a material is either one option or one per variant.
		const byMaterial = Map.groupBy(group.options, (option) => option.materialId);
		const overlapping = [...byMaterial.values()].some(
			(same) =>
				same.length > 1 &&
				(same.some((option) => !option.variantId) ||
					new Set(same.map((option) => option.variantId)).size < same.length)
		);
		if (overlapping) {
			return 'Die Materialien eines Teils überschneiden sich: Nimm ein Material entweder einmal mit beliebiger Variante auf oder mit unterschiedlichen, bestimmten Varianten.';
		}
	}

	/** The validation error of a group's amounts, if any. */
	function amountsError(group: Group): string | undefined {
		if (group.amounts.every((amount) => !(amount.requiredUnits > 0))) {
			return 'Mindestens eine Ausführung braucht Einheiten.';
		}
		if (group.amounts.length < 2) return;
		const labels = group.amounts.map((amount) => amount.label.trim());
		if (labels.some((label) => !label)) return 'Gib jeder Ausführung eine Bezeichnung.';
		if (new Set(labels).size < labels.length) {
			return 'Jede Bezeichnung kann pro Teil nur einmal vorkommen.';
		}
	}

	/** Whether [group] is optional, i.e. has an amount of 0 ("ohne"). */
	function isOptional(group: Group) {
		return group.amounts.some((amount) => amount.requiredUnits === 0);
	}

	/**
	 * The "Optional" shortcut: adds an amount "ohne" = 0 as the default (naming a single unnamed amount "mit"), or
	 * removes the amounts of 0.
	 */
	function setOptional(group: Group, optional: boolean) {
		if (optional) {
			const [only] = group.amounts.length === 1 ? group.amounts : [];
			if (only && !only.label.trim()) only.label = 'mit';
			group.amounts.unshift({ label: 'ohne', requiredUnits: 0 });
		} else {
			const rest = group.amounts.filter((amount) => amount.requiredUnits !== 0);
			group.amounts = rest.length > 0 ? rest : [{ label: '', requiredUnits: 1 }];
		}
	}

	const noParts = $derived(form.groups.length === 0);
	const isValid = $derived(
		!noParts && form.groups.every((group) => !groupError(group) && !amountsError(group))
	);

	function newOption() {
		return { materialId: '', variantId: null as string | null, unitValue: 1 };
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
				name: orNull(group.name),
				amounts: group.amounts.map(({ label, requiredUnits }) => ({
					label: group.amounts.length > 1 ? orNull(label) : null,
					requiredUnits
				})),
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
			Kohtenblätter). Ein Teil kann mehrere Ausführungen haben (z. B. Einbein mit 1 und Dreibein mit
			3 Jurtenstangen), von denen in der Packliste eine gewählt wird. Optionale Teile haben eine
			Ausführung „ohne“ mit 0 Einheiten.
		</p>
		<p class="text-sm text-muted-foreground">
			Bei Materialien mit Varianten (z. B. Seil mit 10 m, 15 m und 20 m) zählt „beliebige Variante“
			jede Variante mit denselben Einheiten, auch später angelegte. Zählen die Varianten
			unterschiedlich (z. B. Kanister mit 10 L und 20 L), nimm sie einzeln als Alternativen auf.
		</p>
	</div>

	{#each form.groups as group, g (group)}
		{@const error = submitted ? groupError(group) : undefined}
		{@const amountsErr = submitted ? amountsError(group) : undefined}
		{@const [single] = group.amounts.length === 1 ? group.amounts : []}
		{@const partName = group.name || `Teil ${g + 1}`}
		<Card.Root>
			<Card.Content class="space-y-4">
				<div
					class={[
						'grid gap-4 sm:items-end',
						single ? 'sm:grid-cols-[1fr_8rem_auto]' : 'sm:grid-cols-[1fr_auto]'
					]}
				>
					<Field label="Name (optional)" id="group-{g}-name">
						<Input id="group-{g}-name" bind:value={group.name} placeholder="z. B. Dach" />
					</Field>
					{#if single}
						<Field label="Einheiten" id="group-{g}-units">
							<Input
								id="group-{g}-units"
								type="number"
								min={1}
								required
								aria-describedby={amountsErr ? `group-${g}-amounts-error` : undefined}
								bind:value={single.requiredUnits}
							/>
						</Field>
					{/if}
					<div class="flex h-9 items-center gap-2">
						<Checkbox
							id="group-{g}-optional"
							checked={isOptional(group)}
							onCheckedChange={(checked) => setOptional(group, checked)}
						/>
						<Label for="group-{g}-optional">Optional</Label>
					</div>
				</div>

				{#if !single}
					<div class="space-y-2">
						<div class="flex items-end gap-2 text-sm font-medium">
							<span class="flex-1">
								Ausführungen <span class="font-normal text-muted-foreground"
									>(die erste ist in der Packliste voreingestellt)</span
								>
							</span>
							<span class="w-20 text-xs leading-tight">Einheiten</span>
							<span class="w-16 pointer-coarse:w-24"></span>
						</div>
						{#each group.amounts as amount, a (amount)}
							{@const amountName = `Ausführung ${a + 1} von ${partName}`}
							<div class="flex items-center gap-2">
								<Input
									class="min-w-0 flex-1"
									maxlength={100}
									placeholder={a === 0 ? 'z. B. Einbein' : 'z. B. Dreibein'}
									aria-label="Bezeichnung für {amountName}"
									aria-describedby={amountsErr ? `group-${g}-amounts-error` : undefined}
									aria-invalid={(submitted && !amount.label.trim()) || undefined}
									bind:value={amount.label}
								/>
								<Input
									type="number"
									min={0}
									required
									class="w-20"
									aria-label="Einheiten für {amountName}"
									bind:value={amount.requiredUnits}
								/>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="{amountName} nach oben"
									title="Nach oben"
									disabled={a === 0}
									onclick={() => moveUp(group.amounts, a)}
								>
									<ArrowUpIcon />
								</Button>
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="{amountName} entfernen"
									title="Entfernen"
									onclick={() => group.amounts.splice(a, 1)}
								>
									<XIcon />
								</Button>
							</div>
						{/each}
					</div>
				{/if}
				{#if amountsErr}
					<p id="group-{g}-amounts-error" class="text-sm text-destructive">{amountsErr}</p>
				{/if}

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
									bind:materialId={option.materialId}
									bind:variantId={option.variantId}
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
				<div class="flex flex-wrap gap-2">
					<Button variant="outline" size="sm" onclick={() => group.options.push(newOption())}>
						<PlusIcon />Alternative hinzufügen
					</Button>
					<Button
						variant="outline"
						size="sm"
						onclick={() => group.amounts.push({ label: '', requiredUnits: 1 })}
					>
						<PlusIcon />Ausführung hinzufügen
					</Button>
				</div>
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
				form.groups.push({
					name: '',
					amounts: [{ label: '', requiredUnits: 1 }],
					options: [newOption()]
				})}
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
