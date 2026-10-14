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
	/** The saved name, for the title while the name is being edited. */
	let savedName = $state('');
	/** The stock when the dialog opened; the API rejects the update if a purchase changed it since. */
	let savedAvailableCount = $state<number | null>(null);
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
		savedName = material?.name ?? '';
		savedAvailableCount = material?.trackingType === 'BULK' ? material.availableCount : null;
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
						locationDetail: orNull(form.locationDetail),
						expectedAvailableCount: savedAvailableCount
					}
				: { ...common, trackingType: 'INDIVIDUAL' };
		if (id) {
			return mutate(
				api.PUT('/materials/{id}', { params: { path: { id } }, body }),
				`${form.name} gespeichert`
			);
		}
		// Individual materials need items next, which are added on the material's page.
		return mutate(api.POST('/materials', { body }), `${form.name} angelegt`, {
			redirectTo:
				body.trackingType === 'INDIVIDUAL' ? (created) => `/materials/${created.id}` : undefined
		});
	}
</script>

<FormDialog
	bind:open
	title={id ? `${savedName} bearbeiten` : 'Material anlegen'}
	submitLabel={id ? 'Speichern' : 'Anlegen'}
	onsubmit={save}
>
	<Field label="Name" id="material-name">
		<Input id="material-name" bind:value={form.name} required maxlength={255} />
	</Field>
	{#if !id}
		<Field label="Erfassung" id="material-type">
			<SelectField
				id="material-type"
				bind:value={form.trackingType}
				options={optionsOf(trackingTypeLabels)}
			/>
		</Field>
		<p class="text-sm text-muted-foreground">
			Nach Menge wird gezählt (z. B. Heringe), einzeln erfasste Materialien haben Gegenstände mit
			Kennung und Zustand (z. B. Zelte). Das lässt sich später nicht ändern.
		</p>
	{/if}
	<Field label="Kategorie" id="material-category">
		<Input id="material-category" bind:value={form.category} maxlength={100} />
	</Field>
	<Field label="Beschreibung" id="material-description">
		<Input id="material-description" bind:value={form.description} />
	</Field>
	{#if form.trackingType === 'BULK'}
		<div class="grid grid-cols-2 gap-4">
			<Field label="Bestand (einsatzbereit)" id="material-available">
				<Input
					id="material-available"
					type="number"
					min={0}
					required
					bind:value={form.availableCount}
				/>
			</Field>
			<Field label="Beschädigt" id="material-damaged">
				<Input
					id="material-damaged"
					type="number"
					min={0}
					required
					bind:value={form.damagedCount}
				/>
			</Field>
		</div>
		{#if id}
			<p class="text-sm text-muted-foreground">
				Erfasste Einkäufe erhöhen den Bestand automatisch.
			</p>
		{/if}
		<Field label="Lagerort" id="material-location">
			<SelectField
				id="material-location"
				bind:value={form.storageLocationId}
				options={locationOptions(locations)}
			/>
		</Field>
		<Field label="Platz im Lagerort" id="material-location-detail">
			<Input
				id="material-location-detail"
				bind:value={form.locationDetail}
				maxlength={255}
				placeholder="z. B. Regal 3, Kiste 2"
			/>
		</Field>
	{/if}
</FormDialog>
