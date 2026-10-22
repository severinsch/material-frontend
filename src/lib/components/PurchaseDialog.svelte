<script lang="ts">
	import { mutate, type BulkMaterial, type NewPurchase, type Purchase } from '#lib/api/index.js';
	import { orNull, today, variantName, variantOf } from '#lib/format.js';
	import { getTenant } from '#lib/tenant.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let { material }: { material: BulkMaterial } = $props();

	let open = $state(false);
	let id = $state<string | null>(null);
	let form = $state(formOf());
	/** Validation errors are only shown after the first attempt to save. */
	let submitted = $state(false);

	/** The purchased variant's name, e.g. "Seil 15 m", or just the material's name. */
	const name = $derived(variantName(material, variantOf(material, form.variantId)));
	const variantMissing = $derived(!form.variantId);

	function formOf(purchase?: Purchase) {
		return {
			// A purchase stays with its variant, so with several variants it is chosen explicitly. A material with a
			// single variant purchases that one.
			variantId:
				purchase?.variantId ?? (material.variants.length === 1 ? material.variants[0].id : ''),
			quantity: purchase?.quantity ?? 1,
			unitPrice: purchase?.unitPrice ?? null,
			purchaseDate: purchase?.purchaseDate ?? today(),
			note: purchase?.note ?? ''
		};
	}

	/** Opens the dialog to edit [purchase], or to record a new one. */
	export function show(purchase?: Purchase) {
		id = purchase?.id ?? null;
		form = formOf(purchase);
		submitted = false;
		open = true;
	}

	async function save() {
		submitted = true;
		if (variantMissing) return false;
		const body: NewPurchase = {
			...form,
			purchaseDate: orNull(form.purchaseDate),
			note: orNull(form.note)
		};
		const request = id
			? api.PUT('/purchases/{id}', { params: { path: { id } }, body })
			: api.POST('/purchases', { body });
		return mutate(request, 'Einkauf gespeichert, Bestand angepasst');
	}
</script>

<FormDialog
	bind:open
	title={id ? `Einkauf von ${name} bearbeiten` : `Einkauf von ${material.name} erfassen`}
	submitLabel={id ? 'Speichern' : 'Erfassen'}
	description={id
		? 'Der Bestand wird um die Differenz der Mengen angepasst.'
		: form.variantId
			? `Die Menge wird zum Bestand von ${name} addiert.`
			: 'Die Menge wird zum Bestand der gewählten Variante addiert.'}
	onsubmit={save}
>
	{#if !id && material.variants.length > 1}
		<Field label="Variante" id="purchase-variant">
			<SelectField
				id="purchase-variant"
				bind:value={form.variantId}
				options={material.variants.map((v) => ({ value: v.id, label: v.name ?? '' }))}
				invalid={submitted && variantMissing}
				describedby={submitted && variantMissing ? 'purchase-variant-error' : undefined}
			/>
			{#if submitted && variantMissing}
				<p id="purchase-variant-error" class="text-sm text-destructive">Wähle eine Variante aus.</p>
			{/if}
		</Field>
	{/if}
	<div class="grid grid-cols-2 gap-4">
		<Field label="Menge" id="purchase-quantity">
			<Input id="purchase-quantity" type="number" min={1} required bind:value={form.quantity} />
		</Field>
		<Field label="Stückpreis (€)" id="purchase-price">
			<Input id="purchase-price" type="number" min={0} step={0.01} bind:value={form.unitPrice} />
		</Field>
	</div>
	<Field label="Datum" id="purchase-date">
		<Input id="purchase-date" type="date" bind:value={form.purchaseDate} />
	</Field>
	<Field label="Notiz" id="purchase-note">
		<Input id="purchase-note" bind:value={form.note} />
	</Field>
</FormDialog>
