<script lang="ts">
	import { api, mutate, type Purchase } from '#lib/api/index.js';
	import { orNull, today } from '#lib/format.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	let { material }: { material: { id: string; name: string } } = $props();

	let open = $state(false);
	let id = $state<string | null>(null);
	let form = $state(formOf());

	function formOf(purchase?: Purchase) {
		return {
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
		open = true;
	}

	function save() {
		const body = {
			...form,
			materialId: material.id,
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
	title={id ? `Einkauf von ${material.name} bearbeiten` : `Einkauf von ${material.name} erfassen`}
	submitLabel={id ? 'Speichern' : 'Erfassen'}
	description={id
		? 'Der Bestand wird um die Differenz der Mengen angepasst.'
		: `Die Menge wird zum Bestand von ${material.name} addiert.`}
	onsubmit={save}
>
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
