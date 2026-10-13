<script lang="ts">
	import {
		api,
		mutate,
		type IndividualItem,
		type Loan,
		type Material,
		type NewLoan
	} from '#lib/api/index.js';
	import { orNull, statusLabels, today } from '#lib/format.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	let { materials, items }: { materials: Material[]; items: IndividualItem[] } = $props();

	let open = $state(false);
	let id = $state<string | null>(null);
	/** The items of the edited loan as saved, which stay listed even when unchecked or no longer active. */
	let ownItemIds = $state<string[]>([]);
	let form = $state(formOf());

	const bulkMaterials = $derived(materials.filter((m) => m.trackingType === 'BULK'));
	/** Items that can be lent (active and not on another loan), plus the loan's own items. */
	const itemsByMaterial = $derived(
		materials
			.filter((m) => m.trackingType === 'INDIVIDUAL')
			.map((material) => ({
				material,
				items: items.filter(
					(item) =>
						item.materialId === material.id &&
						(ownItemIds.includes(item.id) || (item.status === 'ACTIVE' && !item.onLoan))
				)
			}))
			.filter(({ items }) => items.length > 0)
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
		ownItemIds = loan?.itemIds ?? [];
		form = formOf(loan);
		open = true;
	}

	function toggleItem(itemId: string, checked: boolean) {
		form.itemIds = checked ? [...form.itemIds, itemId] : form.itemIds.filter((i) => i !== itemId);
	}

	function save() {
		const body: NewLoan = {
			borrower: form.borrower,
			lentAt: form.lentAt,
			dueAt: orNull(form.dueAt),
			returnedAt: orNull(form.returnedAt),
			note: orNull(form.note),
			itemIds: form.itemIds,
			bulkMaterials: Object.entries(form.quantities)
				.filter(([, quantity]) => quantity)
				.map(([materialId, quantity]) => ({ materialId, quantity: quantity! }))
		};
		const request = id
			? api.PUT('/loans/{id}', { params: { path: { id } }, body })
			: api.POST('/loans', { body });
		return mutate(request, `Saved loan to ${form.borrower}`);
	}
</script>

<FormDialog bind:open title={id ? 'Edit loan' : 'Lend material'} onsubmit={save}>
	<Field label="Borrower" id="loan-borrower">
		<Input id="loan-borrower" bind:value={form.borrower} required maxlength={255} />
	</Field>
	<div class="grid grid-cols-2 gap-4">
		<Field label="Lent on" id="loan-lent">
			<Input id="loan-lent" type="date" required bind:value={form.lentAt} />
		</Field>
		<Field label="Due on" id="loan-due">
			<Input id="loan-due" type="date" bind:value={form.dueAt} />
		</Field>
	</div>
	{#if id}
		<Field label="Returned on" id="loan-returned">
			<Input id="loan-returned" type="date" bind:value={form.returnedAt} />
		</Field>
	{/if}
	<Field label="Note" id="loan-note">
		<Input id="loan-note" bind:value={form.note} />
	</Field>

	<div class="grid max-h-72 gap-4 overflow-y-auto rounded-md border p-3">
		{#each itemsByMaterial as { material, items } (material.id)}
			<fieldset class="grid gap-1">
				<legend class="mb-1 text-sm font-medium">{material.name}</legend>
				<div class="flex flex-wrap gap-x-4 gap-y-1">
					{#each items as item (item.id)}
						<div class="flex items-center gap-1.5">
							<Checkbox
								id="loan-item-{item.id}"
								checked={form.itemIds.includes(item.id)}
								onCheckedChange={(checked) => toggleItem(item.id, checked)}
							/>
							<Label for="loan-item-{item.id}" class="font-normal">
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
			<div class="flex items-center justify-between gap-4">
				<Label for="loan-bulk-{material.id}" class="font-normal">{material.name}</Label>
				<Input
					id="loan-bulk-{material.id}"
					type="number"
					min={0}
					class="w-24"
					placeholder="0"
					bind:value={form.quantities[material.id]}
				/>
			</div>
		{/each}
	</div>
</FormDialog>
