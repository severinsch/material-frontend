<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import {
		mutate,
		type IndividualItem,
		type Loan,
		type Material,
		type Member,
		type NewLoan,
		type Variant
	} from '#lib/api/index.js';
	import { orNull, statusLabels, today, variantName, variantsById } from '#lib/format.js';
	import { isAvailableItem, loanContents } from '#lib/loans.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);
	/** Editors lend to anyone; everyone else only to themselves. */
	const canEdit = $derived(tenant.can('EDIT'));

	let {
		materials,
		items,
		members
	}: {
		materials: Material[];
		items: IndividualItem[];
		/** The members editors can choose as borrower. */
		members: Member[];
	} = $props();

	/** The borrower option for someone without an account, who is given by name (no user id). */
	const OTHER = 'other';

	let open = $state(false);
	let id = $state<string | null>(null);
	let title = $state('');
	/** The items of the edited loan as saved, which stay listed even when unchecked or no longer active. */
	let ownItemIds = $state<string[]>([]);
	/** Pieces per variant the edited loan holds if it's open; they count as lent out and are free for it again. */
	let ownPieces = $state<Record<string, number>>({});
	let query = $state('');
	let form = $state(formOf());
	/** The edited loan's borrower, who stays selectable after leaving the tenant. */
	let ownBorrower = $state<{ value: string; label: string } | null>(null);

	const borrowerOptions = $derived([
		...members
			.filter((member) => !member.isDisabled && member.userId !== ownBorrower?.value)
			.map((member) => ({ value: member.userId, label: member.displayName }))
			.concat(ownBorrower ? [ownBorrower] : [])
			.toSorted((a, b) => a.label.localeCompare(b.label)),
		{ value: OTHER, label: 'Jemand ohne Konto' }
	]);
	const borrowerName = $derived(
		form.borrowerId === OTHER
			? form.borrower
			: borrowerOptions.find((option) => option.value === form.borrowerId)?.label
	);

	const variants = $derived(variantsById(materials));
	const itemsById = $derived(new Map(items.map((item) => [item.id, item])));

	const search = $derived(query.trim().toLowerCase());
	const matches = (text: string) => text.toLowerCase().includes(search);

	/** Items of each individual variant that can be picked: active and not lent, plus the loan's own items. */
	const pickable = $derived(
		Map.groupBy(
			items
				.filter(
					(item) => ownItemIds.includes(item.id) || (item.status === 'ACTIVE' && !item.onLoan)
				)
				.toSorted((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true })),
			(item) => item.variantId
		)
	);

	/**
	 * Variants that can be lent or are part of the loan, matching the search by material or variant name or item
	 * identifier, grouped by material. Loans lend specific variants, so every variant is a row of its own.
	 */
	const listed = $derived(
		materials.flatMap((material) => {
			const rows = material.variants.filter(
				(variant) =>
					(free(variant) > 0 || isInLoan(variant.id)) &&
					(matches(variantName(material, variant)) ||
						matches(material.name) ||
						pickable.get(variant.id)?.some((item) => matches(item.identifier)))
			);
			return rows.length > 0 ? [{ material, rows }] : [];
		})
	);

	const lines = $derived(linesOf(form));
	const selection = $derived(loanContents(lines, variants, itemsById));

	function formOf(loan?: Loan) {
		const itemIds = loan?.itemIds ?? [];
		return {
			borrowerId: loan ? (loan.borrowerId ?? OTHER) : canEdit ? OTHER : tenant.user.id,
			borrower: loan && !loan.borrowerId ? loan.borrower : '',
			lentAt: loan?.lentAt ?? today(),
			dueAt: loan?.dueAt ?? '',
			returnedAt: loan?.returnedAt ?? '',
			note: loan?.note ?? '',
			/** Pieces per variant, for variants lent by quantity. */
			quantities: Object.fromEntries(
				(loan?.materials ?? []).map((line) => [line.variantId, line.quantity])
			) as Record<string, number | null>,
			/** Individual variants whose items are picked one by one instead of giving a quantity. */
			picking: Object.fromEntries(
				items.filter((item) => itemIds.includes(item.id)).map((item) => [item.variantId, true])
			) as Record<string, boolean>,
			itemIds
		};
	}

	/** Opens the dialog to edit [loan], or to record a new one. */
	export function show(loan?: Loan) {
		id = loan?.id ?? null;
		title = loan ? `Ausleihe an ${loan.borrower} bearbeiten` : 'Material ausleihen';
		ownBorrower = loan?.borrowerId ? { value: loan.borrowerId, label: loan.borrower } : null;
		ownItemIds = loan?.itemIds ?? [];
		ownPieces = {};
		if (loan && !loan.returnedAt) {
			for (const line of loan.materials) ownPieces[line.variantId] = line.quantity;
			for (const item of loan.itemIds.map((itemId) => itemsById.get(itemId))) {
				if (item && isAvailableItem(item)) {
					ownPieces[item.variantId] = (ownPieces[item.variantId] ?? 0) + 1;
				}
			}
		}
		query = '';
		form = formOf(loan);
		open = true;
	}

	/** Pieces of [variant] that are in storage and can be lent with this loan. */
	function free(variant: Variant) {
		return Math.max(0, variant.availableCount - variant.loanedCount + (ownPieces[variant.id] ?? 0));
	}

	function isInLoan(variantId: string) {
		return !!form.quantities[variantId] || !!form.picking[variantId];
	}

	function pickedOf(variantId: string) {
		return form.itemIds.filter((itemId) => itemsById.get(itemId)?.variantId === variantId);
	}

	/** Switches between a quantity and picking items, keeping the number of pieces when going back to a quantity. */
	function togglePicking(variantId: string) {
		const picked = pickedOf(variantId);
		if (form.picking[variantId]) {
			form.itemIds = form.itemIds.filter((itemId) => !picked.includes(itemId));
			form.quantities[variantId] = picked.length || null;
		} else {
			form.quantities[variantId] = null;
		}
		form.picking[variantId] = !form.picking[variantId];
	}

	function toggleItem(itemId: string, checked: boolean) {
		form.itemIds = checked ? [...form.itemIds, itemId] : form.itemIds.filter((i) => i !== itemId);
	}

	function linesOf({ quantities, picking, itemIds }: typeof form) {
		return {
			itemIds,
			materials: Object.entries(quantities)
				.filter(([variantId, quantity]) => quantity && !picking[variantId])
				.map(([variantId, quantity]) => ({ variantId, quantity: quantity! }))
		};
	}

	function save() {
		const body: NewLoan = {
			borrowerId: form.borrowerId === OTHER ? null : form.borrowerId,
			borrower: form.borrowerId === OTHER ? form.borrower : null,
			lentAt: form.lentAt,
			dueAt: orNull(form.dueAt),
			returnedAt: orNull(form.returnedAt),
			note: orNull(form.note),
			...lines
		};
		const request = id
			? api.PUT('/loans/{id}', { params: { path: { id } }, body })
			: api.POST('/loans', { body });
		return mutate(
			request,
			canEdit ? `Ausleihe an ${borrowerName} gespeichert` : 'Ausleihe gespeichert'
		);
	}
</script>

{#snippet variantRow(material: Material, variant: Variant, label: string)}
	{@const available = free(variant)}
	{@const picking = form.picking[variant.id]}
	{@const name = variantName(material, variant)}
	<div class="grid gap-1.5">
		<div class="flex items-center justify-between gap-4">
			<div class="grid">
				{#if picking}
					<span class="text-sm">{label}</span>
				{:else}
					<Label for="loan-quantity-{variant.id}" class="font-normal">
						<span class="sr-only">{name}</span><span aria-hidden="true">{label}</span>
					</Label>
				{/if}
				<span id="loan-free-{variant.id}" class="text-xs text-muted-foreground tabular-nums">
					{available} verfügbar
				</span>
			</div>
			{#if picking}
				<span class="text-sm tabular-nums">
					{pickedOf(variant.id).length} ausgewählt
				</span>
			{:else}
				<Input
					id="loan-quantity-{variant.id}"
					type="number"
					min={0}
					max={form.returnedAt ? undefined : available}
					class="w-24"
					placeholder="0"
					aria-describedby="loan-free-{variant.id}"
					bind:value={form.quantities[variant.id]}
				/>
			{/if}
		</div>
		{#if material.trackingType === 'INDIVIDUAL'}
			<Button
				variant="link"
				size="sm"
				class="h-auto justify-self-start p-0 text-muted-foreground pointer-coarse:min-h-11"
				aria-expanded={!!picking}
				aria-controls="loan-items-{variant.id}"
				onclick={() => togglePicking(variant.id)}
			>
				{picking ? 'Nur Anzahl angeben' : 'Bestimmte auswählen'}
				<span class="sr-only">({name})</span>
			</Button>
		{/if}
		{#if picking}
			<div id="loan-items-{variant.id}" class="flex flex-wrap gap-x-4 gap-y-1">
				{#each pickable.get(variant.id) ?? [] as item (item.id)}
					<div class="flex items-center gap-1.5 pointer-coarse:min-h-11">
						<Checkbox
							id="loan-item-{item.id}"
							checked={form.itemIds.includes(item.id)}
							onCheckedChange={(checked) => toggleItem(item.id, checked)}
						/>
						<Label for="loan-item-{item.id}" class="font-normal">
							<span class="sr-only">{name}</span>
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
{/snippet}

<FormDialog bind:open {title} submitLabel={id ? 'Speichern' : 'Ausleihen'} onsubmit={save}>
	{#if canEdit}
		<Field label="Ausgeliehen an" id="loan-borrower">
			<SelectField id="loan-borrower" bind:value={form.borrowerId} options={borrowerOptions} />
		</Field>
		{#if form.borrowerId === OTHER}
			<Field label="Name" id="loan-borrower-name">
				<Input
					id="loan-borrower-name"
					bind:value={form.borrower}
					required
					maxlength={255}
					placeholder="z. B. Stamm Nord"
				/>
			</Field>
		{/if}
	{:else}
		<p class="text-sm text-muted-foreground">Die Ausleihe läuft auf deinen Namen.</p>
	{/if}
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
			{#each listed as { material, rows } (material.id)}
				{#if material.variants.length > 1}
					<!-- Variants are lent separately and listed under their material. -->
					<div class="grid gap-2" role="group" aria-labelledby="loan-material-{material.id}">
						<span id="loan-material-{material.id}" class="text-sm font-medium">{material.name}</span
						>
						<div class="grid gap-3 border-l pl-3">
							{#each rows as variant (variant.id)}
								{@render variantRow(material, variant, variant.name ?? '')}
							{/each}
						</div>
					</div>
				{:else}
					{#each rows as variant (variant.id)}
						{@render variantRow(material, variant, material.name)}
					{/each}
				{/if}
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
