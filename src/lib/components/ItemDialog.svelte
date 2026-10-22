<script lang="ts">
	import {
		mutate,
		type IndividualItem,
		type IndividualMaterial,
		type NewIndividualItem,
		type StorageLocation
	} from '#lib/api/index.js';
	import {
		conditionLabels,
		itemName,
		locationOptions,
		optionsOf,
		orNull,
		statusLabels,
		variantName,
		variantOf
	} from '#lib/format.js';
	import { nextIdentifier, numberedIdentifiers } from '#lib/identifiers.js';
	import { getTenant } from '#lib/tenant.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let {
		material,
		items,
		locations
	}: {
		material: IndividualMaterial;
		/** The material's existing items, to suggest the next free identifier of a variant. */
		items: IndividualItem[];
		locations: StorageLocation[];
	} = $props();

	let open = $state(false);
	let edited = $state<IndividualItem | null>(null);
	/** The name of the edited item as saved, for the title. */
	let editedName = $state('');
	let form = $state(formOf());
	/** How many items to add, numbered upwards from the identifier. */
	let count = $state(1);

	const numbered = $derived(count > 1 ? numberedIdentifiers(form.identifier, count) : null);
	const identifiers = $derived(numbered ?? [form.identifier.trim()]);
	const variantOptions = $derived(
		material.variants.map((variant) => ({ value: variant.id, label: variant.name ?? '' }))
	);
	/** The selected variant's name, e.g. "Kohtenplane 45 cm Latz", or just the material's name. */
	const name = $derived(variantName(material, variantOf(material, form.variantId)));
	const countError = $derived(
		count > 1 && !numbered
			? 'Für mehrere Gegenstände muss die Kennung auf eine Zahl enden, z. B. K01.'
			: null
	);

	/** The identifier after the highest one of the variant [variantId]; identifiers are unique per variant. */
	function suggestion(variantId: string) {
		return nextIdentifier(
			items.filter((item) => item.variantId === variantId).map((item) => item.identifier)
		);
	}

	function formOf(item?: IndividualItem, variantId = material.variants[0]?.id ?? '') {
		return {
			variantId: item?.variantId ?? variantId,
			identifier: item?.identifier ?? '',
			condition: item?.condition ?? 'GOOD',
			status: item?.status ?? 'ACTIVE',
			storageLocationId: item?.storageLocation?.id ?? '',
			locationDetail: item?.locationDetail ?? '',
			purchasePrice: item?.purchasePrice ?? null,
			purchaseDate: item?.purchaseDate ?? ''
		};
	}

	/** Opens the dialog to edit [item], or to add new ones to the variant [variantId] (the first by default). */
	export function show(item?: IndividualItem, variantId?: string) {
		edited = item ?? null;
		editedName = item ? itemName(material, variantOf(material, item.variantId), item) : '';
		form = formOf(item, variantId);
		if (!item) form.identifier = suggestion(form.variantId);
		count = 1;
		open = true;
	}

	/** Selects another variant; when adding, the suggested identifier follows unless it was changed. */
	function selectVariant(variantId: string) {
		if (!edited && form.identifier === suggestion(form.variantId)) {
			form.identifier = suggestion(variantId);
		}
		form.variantId = variantId;
	}

	async function save() {
		if (countError) return false;
		const body = (identifier: string): NewIndividualItem => ({
			...form,
			identifier,
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
				`${name} ${form.identifier} gespeichert`
			);
		}
		const added =
			identifiers.length === 1
				? `${name} ${identifiers[0]} hinzugefügt`
				: `${name} ${identifiers[0]} bis ${identifiers.at(-1)} hinzugefügt`;
		return mutate(api.POST('/items/batch', { body: identifiers.map(body) }), added);
	}
</script>

<FormDialog
	bind:open
	title={edited ? `${editedName} bearbeiten` : `Gegenstände zu ${material.name} hinzufügen`}
	submitLabel={edited
		? 'Speichern'
		: identifiers.length === 1
			? 'Hinzufügen'
			: `${identifiers.length} Gegenstände hinzufügen`}
	onsubmit={save}
>
	{#if variantOptions.length > 1}
		<Field label="Variante" id="item-variant">
			<SelectField
				id="item-variant"
				bind:value={() => form.variantId, selectVariant}
				options={variantOptions}
			/>
		</Field>
		{#if edited && form.variantId !== edited.variantId}
			<p class="-mt-2 text-sm text-muted-foreground">
				{editedName} wird zu {name} verschoben.
			</p>
		{/if}
	{/if}
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
					Legt {name} {identifiers[0]} bis {identifiers.at(-1)} mit den Angaben unten an.
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
