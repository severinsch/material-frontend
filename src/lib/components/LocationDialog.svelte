<script lang="ts">
	import { api, mutate, type StorageLocation } from '#lib/api/index.js';
	import { orNull } from '#lib/format.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	let open = $state(false);
	let id = $state<string | null>(null);
	let form = $state({ name: '', description: '' });

	/** Opens the dialog to edit [location], or to add a new one. */
	export function show(location?: StorageLocation) {
		id = location?.id ?? null;
		form = { name: location?.name ?? '', description: location?.description ?? '' };
		open = true;
	}

	function save() {
		const body = { name: form.name, description: orNull(form.description) };
		const request = id
			? api.PUT('/locations/{id}', { params: { path: { id } }, body })
			: api.POST('/locations', { body });
		return mutate(request, `Saved ${form.name}`);
	}
</script>

<FormDialog bind:open title={id ? 'Edit location' : 'Add location'} onsubmit={save}>
	<Field label="Name" id="location-name">
		<Input
			id="location-name"
			bind:value={form.name}
			required
			maxlength={100}
			placeholder="e.g. Basement"
		/>
	</Field>
	<Field label="Description" id="location-description">
		<Input id="location-description" bind:value={form.description} />
	</Field>
</FormDialog>
