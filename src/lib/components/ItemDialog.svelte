<script lang="ts">
	import { api, mutate, type IndividualItem, type StorageLocation } from '#lib/api/index.js';
	import {
		conditionLabels,
		locationOptions,
		optionsOf,
		orNull,
		statusLabels
	} from '#lib/format.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	let { materialId, locations }: { materialId: string; locations: StorageLocation[] } = $props();

	let open = $state(false);
	let id = $state<string | null>(null);
	let form = $state(formOf());

	function formOf(item?: IndividualItem) {
		return {
			identifier: item?.identifier ?? '',
			condition: item?.condition ?? 'GOOD',
			status: item?.status ?? 'ACTIVE',
			storageLocationId: item?.storageLocation?.id ?? '',
			locationDetail: item?.locationDetail ?? '',
			purchasePrice: item?.purchasePrice ?? null,
			purchaseDate: item?.purchaseDate ?? ''
		};
	}

	/** Opens the dialog to edit [item], or to add a new one. */
	export function show(item?: IndividualItem) {
		id = item?.id ?? null;
		form = formOf(item);
		open = true;
	}

	function save() {
		const body = {
			...form,
			materialId,
			storageLocationId: orNull(form.storageLocationId),
			locationDetail: orNull(form.locationDetail),
			purchaseDate: orNull(form.purchaseDate)
		};
		const request = id
			? api.PUT('/items/{id}', { params: { path: { id } }, body })
			: api.POST('/items', { body });
		return mutate(request, `Saved ${form.identifier}`);
	}
</script>

<FormDialog bind:open title={id ? 'Edit item' : 'Add item'} onsubmit={save}>
	<Field label="Identifier" id="item-identifier">
		<Input
			id="item-identifier"
			bind:value={form.identifier}
			required
			maxlength={100}
			placeholder="e.g. 7"
		/>
	</Field>
	<div class="grid grid-cols-2 gap-4">
		<Field label="Condition" id="item-condition">
			<SelectField
				id="item-condition"
				bind:value={form.condition}
				options={optionsOf(conditionLabels)}
			/>
		</Field>
		<Field label="Status" id="item-status">
			<SelectField id="item-status" bind:value={form.status} options={optionsOf(statusLabels)} />
		</Field>
	</div>
	<Field label="Location" id="item-location">
		<SelectField
			id="item-location"
			bind:value={form.storageLocationId}
			options={locationOptions(locations)}
		/>
	</Field>
	<Field label="Place in location" id="item-location-detail">
		<Input
			id="item-location-detail"
			bind:value={form.locationDetail}
			placeholder="e.g. shelf 3, box 2"
		/>
	</Field>
	<div class="grid grid-cols-2 gap-4">
		<Field label="Purchase price" id="item-price">
			<Input id="item-price" type="number" min={0} step={0.01} bind:value={form.purchasePrice} />
		</Field>
		<Field label="Purchase date" id="item-date">
			<Input id="item-date" type="date" bind:value={form.purchaseDate} />
		</Field>
	</div>
</FormDialog>
