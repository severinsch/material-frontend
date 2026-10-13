<script lang="ts">
	import {
		api,
		mutate,
		type Material,
		type NewMaterial,
		type StorageLocation
	} from '#lib/api/index.js';
	import { locationOptions, optionsOf, orNull, trackingTypeLabels } from '#lib/format.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	let { locations }: { locations: StorageLocation[] } = $props();

	let open = $state(false);
	let id = $state<string | null>(null);
	let form = $state(formOf());

	function formOf(material?: Material) {
		const bulk = material?.trackingType === 'BULK' ? material : undefined;
		return {
			trackingType: material?.trackingType ?? 'BULK',
			name: material?.name ?? '',
			category: material?.category ?? '',
			description: material?.description ?? '',
			availableCount: bulk?.availableCount ?? 0,
			damagedCount: bulk?.damagedCount ?? 0,
			storageLocationId: bulk?.location?.id ?? '',
			locationDetail: bulk?.locationDetail ?? ''
		};
	}

	/** Opens the dialog to edit [material], or to create a new one. */
	export function show(material?: Material) {
		id = material?.id ?? null;
		form = formOf(material);
		open = true;
	}

	function save() {
		const common = {
			name: form.name,
			category: orNull(form.category),
			description: orNull(form.description)
		};
		const body: NewMaterial =
			form.trackingType === 'BULK'
				? {
						...common,
						trackingType: 'BULK',
						availableCount: form.availableCount,
						damagedCount: form.damagedCount,
						storageLocationId: orNull(form.storageLocationId),
						locationDetail: orNull(form.locationDetail)
					}
				: { ...common, trackingType: 'INDIVIDUAL' };
		const request = id
			? api.PUT('/materials/{id}', { params: { path: { id } }, body })
			: api.POST('/materials', { body });
		return mutate(request, `Saved ${form.name}`);
	}
</script>

<FormDialog bind:open title={id ? 'Edit material' : 'Add material'} onsubmit={save}>
	<Field label="Name" id="material-name">
		<Input id="material-name" bind:value={form.name} required maxlength={255} />
	</Field>
	{#if !id}
		<Field label="Tracking" id="material-type">
			<SelectField
				id="material-type"
				bind:value={form.trackingType}
				options={optionsOf(trackingTypeLabels)}
			/>
		</Field>
		<p class="text-sm text-muted-foreground">
			Bulk materials are counted (e.g. tent pegs), individual materials are tracked piece by piece
			(e.g. tents). This can't be changed later.
		</p>
	{/if}
	<Field label="Category" id="material-category">
		<Input id="material-category" bind:value={form.category} maxlength={100} />
	</Field>
	<Field label="Description" id="material-description">
		<Input id="material-description" bind:value={form.description} />
	</Field>
	{#if form.trackingType === 'BULK'}
		<div class="grid grid-cols-2 gap-4">
			<Field label="Available" id="material-available">
				<Input
					id="material-available"
					type="number"
					min={0}
					required
					bind:value={form.availableCount}
				/>
			</Field>
			<Field label="Damaged" id="material-damaged">
				<Input
					id="material-damaged"
					type="number"
					min={0}
					required
					bind:value={form.damagedCount}
				/>
			</Field>
		</div>
		<Field label="Location" id="material-location">
			<SelectField
				id="material-location"
				bind:value={form.storageLocationId}
				options={locationOptions(locations)}
			/>
		</Field>
		<Field label="Place in location" id="material-location-detail">
			<Input
				id="material-location-detail"
				bind:value={form.locationDetail}
				placeholder="e.g. shelf 3, box 2"
			/>
		</Field>
	{/if}
</FormDialog>
