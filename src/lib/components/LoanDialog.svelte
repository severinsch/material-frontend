<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import {
		api,
		mutate,
		type IndividualItem,
		type Loan,
		type Material,
		type NewLoan
	} from '#lib/api/index.js';
	import { orNull, statusLabels, today } from '#lib/format.js';
	import { loanContents } from '#lib/loans.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	let { materials, items }: { materials: Material[]; items: IndividualItem[] } = $props();

	let open = $state(false);
	let id = $state<string | null>(null);
	let title = $state('');
	/** The items of the edited loan as saved, which stay listed even when unchecked or no longer active. */
	let ownItemIds = $state<string[]>([]);
	/** Bulk quantities of the edited loan if it's open; they count as lent out and are free for this loan again. */
	let ownQuantities = $state<Record<string, number>>({});
	let query = $state('');
	let form = $state(formOf());

	const materialsById = $derived(new Map(materials.map((m) => [m.id, m])));
	const itemsById = $derived(new Map(items.map((item) => [item.id, item])));

	const search = $derived(query.trim().toLowerCase());
	const matches = (text: string) => text.toLowerCase().includes(search);

	const bulkMaterials = $derived(
		materials.filter((m) => m.trackingType === 'BULK' && matches(m.name))
	);
	/** Items that can be lent (active and not on another loan), plus the loan's own items. */
	const itemsByMaterial = $derived(
		materials
			.filter((m) => m.trackingType === 'INDIVIDUAL')
			.map((material) => ({
				material,
				items: items
					.filter(
						(item) =>
							item.materialId === material.id &&
							(ownItemIds.includes(item.id) || (item.status === 'ACTIVE' && !item.onLoan)) &&
							(matches(material.name) || matches(item.identifier))
					)
					.sort((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))
			}))
			.filter(({ items }) => items.length > 0)
	);

	const selection = $derived(
		loanContents({ itemIds: form.itemIds, bulkMaterials: bulkLines() }, materialsById, itemsById)
	);

	function formOf(loan?: Loan) {
		return {
			borrower: loan?.borrower ?? '',
			lentAt: loan?.lentAt ?? today(),
			dueAt: loan?.dueAt ?? '',
			returnedAt: loan?.returnedAt ?? '',
			note: loan?.note ?? '',
			itemIds: loan?.itemIds ?? [],
			quantities: Object.fromEntries(
				(loan?.bulkMaterials ?? []).map((line) => [line.materialId, line.quantity])
			) as Record<string, number | null>
		};
	}

	/** Opens the dialog to edit [loan], or to record a new one. */
	export function show(loan?: Loan) {
		id = loan?.id ?? null;
		title = loan ? `Ausleihe an ${loan.borrower} bearbeiten` : 'Material ausleihen';
		ownItemIds = loan?.itemIds ?? [];
		ownQuantities =
			loan && !loan.returnedAt
				? Object.fromEntries(loan.bulkMaterials.map((line) => [line.materialId, line.quantity]))
				: {};
		query = '';
		form = formOf(loan);
		open = true;
	}

	/** Pieces of a bulk material that are in storage and can be lent with this loan. */
	function free(material: Material) {
		return material.availableCount - material.loanedCount + (ownQuantities[material.id] ?? 0);
	}

	function toggleItem(itemId: string, checked: boolean) {
		form.itemIds = checked ? [...form.itemIds, itemId] : form.itemIds.filter((i) => i !== itemId);
	}

	function bulkLines() {
		return Object.entries(form.quantities)
			.filter(([, quantity]) => quantity)
			.map(([materialId, quantity]) => ({ materialId, quantity: quantity! }));
	}

	function save() {
		const body: NewLoan = {
			borrower: form.borrower,
			lentAt: form.lentAt,
			dueAt: orNull(form.dueAt),
			returnedAt: orNull(form.returnedAt),
			note: orNull(form.note),
			itemIds: form.itemIds,
			bulkMaterials: bulkLines()
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
		<div class="grid max-h-72 gap-4 overflow-y-auto rounded-md border p-3">
			{#each itemsByMaterial as { material, items } (material.id)}
				<fieldset class="grid gap-1">
					<legend class="mb-1 text-sm font-medium">{material.name}</legend>
					<div class="flex flex-wrap gap-x-4 gap-y-1">
						{#each items as item (item.id)}
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
						{/each}
					</div>
				</fieldset>
			{/each}
			{#each bulkMaterials as material (material.id)}
				{@const available = free(material)}
				<div class="flex items-center justify-between gap-4">
					<div class="grid">
						<Label for="loan-bulk-{material.id}" class="font-normal">{material.name}</Label>
						<span
							id="loan-bulk-{material.id}-free"
							class="text-xs text-muted-foreground tabular-nums"
						>
							{available} verfügbar
						</span>
					</div>
					<Input
						id="loan-bulk-{material.id}"
						type="number"
						min={0}
						max={form.returnedAt ? undefined : Math.max(available, 0)}
						class="w-24"
						placeholder="0"
						aria-describedby="loan-bulk-{material.id}-free"
						bind:value={form.quantities[material.id]}
					/>
				</div>
			{/each}
			{#if itemsByMaterial.length === 0 && bulkMaterials.length === 0}
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
