<script lang="ts">
	import {
		api,
		mutate,
		type IndividualItem,
		type NewIndividualItem,
		type StorageLocation
	} from '#lib/api/index.js';
	import {
		conditionLabels,
		locationOptions,
		optionsOf,
		orNull,
		statusLabels
	} from '#lib/format.js';
	import { nextIdentifier, numberedIdentifiers } from '#lib/identifiers.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	let {
		material,
		items,
		locations
	}: {
		material: { id: string; name: string };
		/** The material's existing items, to suggest the next free identifier. */
		items: IndividualItem[];
		locations: StorageLocation[];
	} = $props();

	let open = $state(false);
	let edited = $state<IndividualItem | null>(null);
	let form = $state(formOf());
	/** How many items to add, numbered upwards from the identifier. */
	let count = $state(1);

	const numbered = $derived(count > 1 ? numberedIdentifiers(form.identifier, count) : null);
	const identifiers = $derived(numbered ?? [form.identifier.trim()]);
	const countError = $derived(
		count > 1 && !numbered
			? 'Für mehrere Gegenstände muss die Kennung auf eine Zahl enden, z. B. K01.'
			: null
	);

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

	/** Opens the dialog to edit [item], or to add new ones. */
	export function show(item?: IndividualItem) {
		edited = item ?? null;
		form = item
			? formOf(item)
			: { ...formOf(), identifier: nextIdentifier(items.map((i) => i.identifier)) };
		count = 1;
		open = true;
	}

	async function save() {
		if (countError) return false;
		const body = (identifier: string): NewIndividualItem => ({
			...form,
			identifier,
			materialId: material.id,
			storageLocationId: orNull(form.storageLocationId),
			locationDetail: orNull(form.locationDetail),
			purchaseDate: orNull(form.purchaseDate)
		});
		if (edited) {
			return mutate(
				api.PUT('/items/{id}', {
					params: { path: { id: edited.id } },
					body: body(form.identifier)
				}),
				`${material.name} ${form.identifier} gespeichert`
			);
		}
		const added =
			identifiers.length === 1
				? `${material.name} ${identifiers[0]} hinzugefügt`
				: `${material.name} ${identifiers[0]} bis ${identifiers.at(-1)} hinzugefügt`;
		return mutate(api.POST('/items/batch', { body: identifiers.map(body) }), added);
	}
</script>

<FormDialog
	bind:open
	title={edited
		? `${material.name} ${edited.identifier} bearbeiten`
		: `Gegenstände zu ${material.name} hinzufügen`}
	submitLabel={edited
		? 'Speichern'
		: identifiers.length === 1
			? 'Hinzufügen'
			: `${identifiers.length} Gegenstände hinzufügen`}
	onsubmit={save}
>
	<div class={edited ? 'grid' : 'grid grid-cols-[1fr_6rem] gap-4'}>
		<Field label={count > 1 ? 'Erste Kennung' : 'Kennung'} id="item-identifier">
			<Input
				id="item-identifier"
				bind:value={form.identifier}
				required
				maxlength={100}
				placeholder="z. B. K01"
			/>
		</Field>
		{#if !edited}
			<Field label="Anzahl" id="item-count">
				<Input
					id="item-count"
					type="number"
					min={1}
					max={100}
					required
					bind:value={count}
					aria-invalid={countError ? true : undefined}
					aria-describedby="item-count-hint"
				/>
			</Field>
			<p
				id="item-count-hint"
				class={[
					'col-span-2 -mt-2 text-sm',
					countError ? 'text-destructive' : 'text-muted-foreground'
				]}
			>
				{#if countError}
					{countError}
				{:else if identifiers.length > 1}
					Legt {material.name} {identifiers[0]} bis {identifiers.at(-1)} mit den Angaben unten an.
				{:else}
					Mehrere Gegenstände werden ab dieser Kennung durchnummeriert.
				{/if}
			</p>
		{/if}
	</div>
	<div class="grid grid-cols-2 gap-4">
		<Field label="Zustand" id="item-condition">
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
	<Field label="Lagerort" id="item-location">
		<SelectField
			id="item-location"
			bind:value={form.storageLocationId}
			options={locationOptions(locations)}
		/>
	</Field>
	<Field label="Platz im Lagerort" id="item-location-detail">
		<Input
			id="item-location-detail"
			bind:value={form.locationDetail}
			maxlength={255}
			placeholder="z. B. Regal 3, Kiste 2"
		/>
	</Field>
	<div class="grid grid-cols-2 gap-4">
		<Field label="Kaufpreis (€)" id="item-price">
			<Input id="item-price" type="number" min={0} step={0.01} bind:value={form.purchasePrice} />
		</Field>
		<Field label="Kaufdatum" id="item-date">
			<Input id="item-date" type="date" bind:value={form.purchaseDate} />
		</Field>
	</div>
</FormDialog>
