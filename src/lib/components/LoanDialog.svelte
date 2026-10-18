<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import {
		mutate,
		type IndividualItem,
		type Loan,
		type Material,
		type NewLoan
	} from '#lib/api/index.js';
	import { orNull, statusLabels, today } from '#lib/format.js';
	import { isAvailableItem, loanContents } from '#lib/loans.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let { materials, items }: { materials: Material[]; items: IndividualItem[] } = $props();

	let open = $state(false);
	let id = $state<string | null>(null);
	let title = $state('');
	/** The items of the edited loan as saved, which stay listed even when unchecked or no longer active. */
	let ownItemIds = $state<string[]>([]);
	/** Pieces per material the edited loan holds if it's open; they count as lent out and are free for it again. */
	let ownPieces = $state<Record<string, number>>({});
	let query = $state('');
	let form = $state(formOf());

	const materialsById = $derived(new Map(materials.map((m) => [m.id, m])));
	const itemsById = $derived(new Map(items.map((item) => [item.id, item])));

	const search = $derived(query.trim().toLowerCase());
	const matches = (text: string) => text.toLowerCase().includes(search);

	/** Items of each individual material that can be picked: active and not lent, plus the loan's own items. */
	const pickable = $derived(
		Map.groupBy(
			items
				.filter(
					(item) => ownItemIds.includes(item.id) || (item.status === 'ACTIVE' && !item.onLoan)
				)
				.toSorted((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true })),
			(item) => item.materialId
		)
	);

	/** Materials that can be lent or are part of the loan, matching the search by name or item identifier. */
	const listed = $derived(
		materials.filter(
			(material) =>
				(free(material) > 0 || isInLoan(material.id)) &&
				(matches(material.name) ||
					pickable.get(material.id)?.some((item) => matches(item.identifier)))
		)
	);

	const lines = $derived(linesOf(form));
	const selection = $derived(loanContents(lines, materialsById, itemsById));

	function formOf(loan?: Loan) {
		const itemIds = loan?.itemIds ?? [];
		return {
			borrower: loan?.borrower ?? '',
			lentAt: loan?.lentAt ?? today(),
			dueAt: loan?.dueAt ?? '',
			returnedAt: loan?.returnedAt ?? '',
			note: loan?.note ?? '',
			/** Pieces per material, for materials lent by quantity. */
			quantities: Object.fromEntries(
				(loan?.materials ?? []).map((line) => [line.materialId, line.quantity])
			) as Record<string, number | null>,
			/** Individual materials whose items are picked one by one instead of giving a quantity. */
			picking: Object.fromEntries(
				items.filter((item) => itemIds.includes(item.id)).map((item) => [item.materialId, true])
			) as Record<string, boolean>,
			itemIds
		};
	}

	/** Opens the dialog to edit [loan], or to record a new one. */
	export function show(loan?: Loan) {
		id = loan?.id ?? null;
		title = loan ? `Ausleihe an ${loan.borrower} bearbeiten` : 'Material ausleihen';
		ownItemIds = loan?.itemIds ?? [];
		ownPieces = {};
		if (loan && !loan.returnedAt) {
			for (const line of loan.materials) ownPieces[line.materialId] = line.quantity;
			for (const item of loan.itemIds.map((itemId) => itemsById.get(itemId))) {
				if (item && isAvailableItem(item)) {
					ownPieces[item.materialId] = (ownPieces[item.materialId] ?? 0) + 1;
				}
			}
		}
		query = '';
		form = formOf(loan);
		open = true;
	}

	/** Pieces of [material] that are in storage and can be lent with this loan. */
	function free(material: Material) {
		return Math.max(
			0,
			material.availableCount - material.loanedCount + (ownPieces[material.id] ?? 0)
		);
	}

	function isInLoan(materialId: string) {
		return !!form.quantities[materialId] || !!form.picking[materialId];
	}

	function pickedOf(materialId: string) {
		return form.itemIds.filter((itemId) => itemsById.get(itemId)?.materialId === materialId);
	}

	/** Switches between a quantity and picking items, keeping the number of pieces when going back to a quantity. */
	function togglePicking(materialId: string) {
		const picked = pickedOf(materialId);
		if (form.picking[materialId]) {
			form.itemIds = form.itemIds.filter((itemId) => !picked.includes(itemId));
			form.quantities[materialId] = picked.length || null;
		} else {
			form.quantities[materialId] = null;
		}
		form.picking[materialId] = !form.picking[materialId];
	}

	function toggleItem(itemId: string, checked: boolean) {
		form.itemIds = checked ? [...form.itemIds, itemId] : form.itemIds.filter((i) => i !== itemId);
	}

	function linesOf({ quantities, picking, itemIds }: typeof form) {
		return {
			itemIds,
			materials: Object.entries(quantities)
				.filter(([materialId, quantity]) => quantity && !picking[materialId])
				.map(([materialId, quantity]) => ({ materialId, quantity: quantity! }))
		};
	}

	function save() {
		const body: NewLoan = {
			borrower: form.borrower,
			lentAt: form.lentAt,
			dueAt: orNull(form.dueAt),
			returnedAt: orNull(form.returnedAt),
			note: orNull(form.note),
			...lines
		};
		const request = id
			? api.PUT('/loans/{id}', { params: { path: { id } }, body })
			: api.POST('/loans', { body });
		return mutate(request, `Ausleihe an ${form.borrower} gespeichert`);
	}
</script>

<FormDialog bind:open {title} submitLabel={id ? 'Speichern' : 'Ausleihen'} onsubmit={save}>
	<Field label="Ausgeliehen an" id="loan-borrower">
		<Input
			id="loan-borrower"
			bind:value={form.borrower}
			required
			maxlength={255}
			placeholder="z. B. Stamm Nord"
		/>
	</Field>
	<div class="grid grid-cols-2 gap-4">
		<Field label="Ausgeliehen am" id="loan-lent">
			<Input id="loan-lent" type="date" required bind:value={form.lentAt} />
		</Field>
		<Field label="Rückgabe bis" id="loan-due">
			<Input id="loan-due" type="date" min={form.lentAt} bind:value={form.dueAt} />
		</Field>
	</div>
	{#if id}
		<Field label="Zurückgegeben am" id="loan-returned">
			<Input id="loan-returned" type="date" min={form.lentAt} bind:value={form.returnedAt} />
		</Field>
	{/if}
	<Field label="Notiz" id="loan-note">
		<Input id="loan-note" bind:value={form.note} />
	</Field>

	<fieldset class="grid gap-2">
		<legend class="mb-2 text-sm font-medium">Was wird ausgeliehen?</legend>
		<div class="relative">
			<SearchIcon
				class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
			/>
			<Input
				type="search"
				placeholder="Material oder Kennung suchen…"
				aria-label="Material oder Kennung suchen"
				class="pl-9"
				bind:value={query}
			/>
		</div>
		<div class="grid max-h-80 gap-4 overflow-y-auto rounded-md border p-3">
			{#each listed as material (material.id)}
				{@const available = free(material)}
				{@const picking = form.picking[material.id]}
				<div class="grid gap-1.5">
					<div class="flex items-center justify-between gap-4">
						<div class="grid">
							{#if picking}
								<span class="text-sm">{material.name}</span>
							{:else}
								<Label for="loan-quantity-{material.id}" class="font-normal">{material.name}</Label>
							{/if}
							<span id="loan-free-{material.id}" class="text-xs text-muted-foreground tabular-nums">
								{available} verfügbar
							</span>
						</div>
						{#if picking}
							<span class="text-sm tabular-nums">
								{pickedOf(material.id).length} ausgewählt
							</span>
						{:else}
							<Input
								id="loan-quantity-{material.id}"
								type="number"
								min={0}
								max={form.returnedAt ? undefined : available}
								class="w-24"
								placeholder="0"
								aria-describedby="loan-free-{material.id}"
								bind:value={form.quantities[material.id]}
							/>
						{/if}
					</div>
					{#if material.trackingType === 'INDIVIDUAL'}
						<Button
							variant="link"
							size="sm"
							class="h-auto justify-self-start p-0 text-muted-foreground pointer-coarse:min-h-11"
							aria-expanded={!!picking}
							aria-controls="loan-items-{material.id}"
							onclick={() => togglePicking(material.id)}
						>
							{picking ? 'Nur Anzahl angeben' : 'Bestimmte auswählen'}
							<span class="sr-only">({material.name})</span>
						</Button>
					{/if}
					{#if picking}
						<div id="loan-items-{material.id}" class="flex flex-wrap gap-x-4 gap-y-1">
							{#each pickable.get(material.id) ?? [] as item (item.id)}
								<div class="flex items-center gap-1.5 pointer-coarse:min-h-11">
									<Checkbox
										id="loan-item-{item.id}"
										checked={form.itemIds.includes(item.id)}
										onCheckedChange={(checked) => toggleItem(item.id, checked)}
									/>
									<Label for="loan-item-{item.id}" class="font-normal">
										<span class="sr-only">{material.name}</span>
										{item.identifier}
										{#if item.status !== 'ACTIVE'}
											<span class="text-destructive">({statusLabels[item.status]})</span>
										{/if}
									</Label>
								</div>
							{:else}
								<p class="text-sm text-muted-foreground">Kein Gegenstand frei.</p>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
			{#if listed.length === 0}
				<p class="text-sm text-muted-foreground">
					{search ? `Nichts passt zu „${query.trim()}“.` : 'Kein Material verfügbar.'}
				</p>
			{/if}
		</div>
		<p class="text-sm text-muted-foreground" aria-live="polite">
			{selection ? `Ausgewählt: ${selection}` : 'Noch nichts ausgewählt.'}
		</p>
	</fieldset>
</FormDialog>
