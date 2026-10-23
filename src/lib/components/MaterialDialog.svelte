<script lang="ts">
	import { tick } from 'svelte';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import {
		mutate,
		type BulkVariant,
		type IndividualItem,
		type Material,
		type NewMaterial,
		type StorageLocation,
		type Variant
	} from '#lib/api/index.js';
	import {
		locationOptions,
		optionsOf,
		orNull,
		trackingTypeLabels,
		variantsError as variantNamesError
	} from '#lib/format.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import ConfirmDelete from './ConfirmDelete.svelte';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	/** [items] are the items of the edited material (or more), since variants with items can't be removed. */
	let { locations, items }: { locations: StorageLocation[]; items: IndividualItem[] } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let open = $state(false);
	let id = $state<string | null>(null);
	/** The saved name, for the title while the name is being edited. */
	let savedName = $state('');
	let form = $state(formOf());
	/** Validation errors are only shown after the first attempt to save. */
	let submitted = $state(false);
	let confirmRemove: ConfirmDelete;

	type VariantForm = ReturnType<typeof variantFormOf>;

	/** A material with one unnamed variant looks like a material without variants; others list them. */
	const listed = $derived(form.variantList || form.variants.length > 1);
	const bulk = $derived(form.trackingType === 'BULK');
	/** Whether all variants share the dialog's location fields, which is the case for a single variant. */
	const sharedLocation = $derived(!listed || !form.locationPerVariant);

	const variantsError = $derived(variantNamesError(form.variants.map((variant) => variant.name)));
	/** Variants with items, in any status, which the API refuses to remove. */
	const variantsWithItems = $derived(new Set(items.map((item) => item.variantId)));
	const hasItems = (variant: VariantForm) => !!variant.id && variantsWithItems.has(variant.id);

	/** The form of [variant], or of a new one stored at [location]. */
	function variantFormOf(
		variant?: Variant,
		location = { storageLocationId: '', locationDetail: '' }
	) {
		// Individual variants have no location; the fields stay empty for them.
		const stock = variant as Partial<BulkVariant> | undefined;
		return {
			id: variant?.id ?? null,
			name: variant?.name ?? '',
			/** The saved name, for the confirmation when removing it. */
			savedName: variant?.name ?? null,
			availableCount: variant?.availableCount ?? 0,
			damagedCount: variant?.damagedCount ?? 0,
			storageLocationId: stock ? (stock.location?.id ?? '') : location.storageLocationId,
			locationDetail: stock ? (stock.locationDetail ?? '') : location.locationDetail,
			/** The stock when the dialog opened; the API rejects the update if a purchase changed it since. */
			expectedAvailableCount: variant?.availableCount ?? null,
			/** Pieces of a bulk variant, to confirm removing a variant that has them. */
			pieces: (variant?.availableCount ?? 0) + (variant?.damagedCount ?? 0)
		};
	}

	function formOf(material?: Material) {
		const variants: VariantForm[] = material?.variants.map((v) => variantFormOf(v)) ?? [
			variantFormOf()
		];
		const [first] = variants;
		const places = new Set(variants.map((v) => `${v.storageLocationId}/${v.locationDetail}`));
		return {
			trackingType: material?.trackingType ?? 'BULK',
			name: material?.name ?? '',
			category: material?.category ?? '',
			description: material?.description ?? '',
			variants,
			/** Saved variants removed in the dialog, deleted when saving. */
			removed: [] as VariantForm[],
			/** Whether the variants are listed, even if there is only one left (which keeps its name). */
			variantList: variants.length > 1 || !!first.name,
			/** One location for all variants, or one per variant ("Lagerort je Variante"). */
			locationPerVariant: places.size > 1,
			storageLocationId: first.storageLocationId,
			locationDetail: first.locationDetail
		};
	}

	/** Opens the dialog to edit [material], or to create a new one. */
	export function show(material?: Material) {
		id = material?.id ?? null;
		savedName = material?.name ?? '';
		form = formOf(material);
		submitted = false;
		open = true;
	}

	/** Switches from a single variant to a list, with a new variant; both need a name then. */
	async function startVariants() {
		form.variantList = true;
		form.variants.push(variantFormOf(undefined, form));
		await focusName(form.variants.findIndex((variant) => !variant.name.trim()));
	}

	async function addVariant() {
		form.variants.push(variantFormOf(undefined, form));
		await focusName(form.variants.length - 1);
	}

	/** Focuses the name field of the variant at [index] once it is rendered. */
	async function focusName(index: number) {
		await tick();
		document.getElementById(`variant-${index}-name`)?.focus();
	}

	/** The saved name of [variant], as the API names it in messages. */
	function savedNameOf(variant: VariantForm) {
		return variant.savedName ?? 'ohne Namen';
	}

	/**
	 * Removes a variant, asking first if it has stock, e.g. "Variante 15 m mit 4 Stück entfernen?" Variants with items
	 * can't be removed (see [hasItems]).
	 */
	function removeVariant(variant: VariantForm) {
		const remove = () => {
			form.variants.splice(form.variants.indexOf(variant), 1);
			if (variant.id) form.removed.push(variant);
		};
		if (!variant.id || !bulk || variant.pieces === 0) {
			remove();
			return;
		}
		confirmRemove.show(
			`Variante ${savedNameOf(variant)} mit ${variant.pieces} Stück`,
			async () => {
				remove();
				return true;
			},
			{
				verb: 'entfernen',
				description: 'Die Variante und ihr Bestand werden beim Speichern gelöscht.'
			}
		);
	}

	function restoreVariant(variant: VariantForm) {
		form.removed.splice(form.removed.indexOf(variant), 1);
		form.variants.push(variant);
	}

	/**
	 * Switching to one location per variant starts with the shared one; switching back takes the first variant's. The
	 * variants keep their own locations meanwhile, so switching off and on again only overwrites them if the shared
	 * location was changed in between.
	 */
	function setLocationPerVariant(perVariant: boolean) {
		const [first] = form.variants;
		const sharedChanged =
			form.storageLocationId !== first.storageLocationId ||
			form.locationDetail !== first.locationDetail;
		if (perVariant && sharedChanged) {
			for (const variant of form.variants) {
				variant.storageLocationId = form.storageLocationId;
				variant.locationDetail = form.locationDetail;
			}
		} else if (!perVariant) {
			form.storageLocationId = first.storageLocationId;
			form.locationDetail = first.locationDetail;
		}
		form.locationPerVariant = perVariant;
	}

	async function save() {
		submitted = true;
		if (variantsError) return false;
		const common = {
			name: form.name,
			category: orNull(form.category),
			description: orNull(form.description),
			removedVariantIds: id ? form.removed.map((variant) => variant.id!) : []
		};
		const location = (variant: VariantForm) => (sharedLocation ? form : variant);
		const body: NewMaterial =
			form.trackingType === 'BULK'
				? {
						...common,
						trackingType: 'BULK',
						variants: form.variants.map((variant) => ({
							id: variant.id,
							name: orNull(variant.name),
							availableCount: variant.availableCount,
							damagedCount: variant.damagedCount,
							storageLocationId: orNull(location(variant).storageLocationId),
							locationDetail: orNull(location(variant).locationDetail),
							expectedAvailableCount: variant.expectedAvailableCount
						}))
					}
				: {
						...common,
						trackingType: 'INDIVIDUAL',
						variants: form.variants.map((variant) => ({
							id: variant.id,
							name: orNull(variant.name)
						}))
					};
		if (id) {
			return mutate(
				api.PUT('/materials/{id}', { params: { path: { id } }, body }),
				`${form.name} gespeichert`
			);
		}
		// Individual materials need items next, which are added on the material's page.
		return mutate(api.POST('/materials', { body }), `${form.name} angelegt`, {
			redirectTo:
				body.trackingType === 'INDIVIDUAL'
					? (created) => tenant.href(`/materials/${created.id}`)
					: undefined
		});
	}
</script>

{#snippet locationFields(
	target: { storageLocationId: string; locationDetail: string },
	key: string
)}
	<Field label="Lagerort" id="material-location{key}">
		<SelectField
			id="material-location{key}"
			bind:value={target.storageLocationId}
			options={locationOptions(locations)}
		/>
	</Field>
	<Field label="Platz im Lagerort" id="material-location-detail{key}">
		<Input
			id="material-location-detail{key}"
			bind:value={target.locationDetail}
			maxlength={255}
			placeholder="z. B. Regal 3, Kiste 2"
		/>
	</Field>
{/snippet}

<FormDialog
	bind:open
	title={id ? `${savedName} bearbeiten` : 'Material anlegen'}
	submitLabel={id ? 'Speichern' : 'Anlegen'}
	class={listed ? 'sm:max-w-lg' : undefined}
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

	{#if !listed}
		{@const [variant] = form.variants}
		{#if bulk}
			<div class="grid grid-cols-2 gap-4">
				<Field label="Bestand (einsatzbereit)" id="material-available">
					<Input
						id="material-available"
						type="number"
						min={0}
						required
						bind:value={variant.availableCount}
					/>
				</Field>
				<Field label="Beschädigt" id="material-damaged">
					<Input
						id="material-damaged"
						type="number"
						min={0}
						required
						bind:value={variant.damagedCount}
					/>
				</Field>
			</div>
			{#if id}
				<p class="text-sm text-muted-foreground">
					Erfasste Einkäufe erhöhen den Bestand automatisch.
				</p>
			{/if}
			{@render locationFields(form, '')}
		{/if}
		<p class="text-sm text-muted-foreground">
			Gibt es das Material in mehreren Längen, Größen oder Ausführungen?
			<Button variant="link" class="h-auto p-0" onclick={startVariants}>Varianten anlegen</Button>
		</p>
	{:else}
		<fieldset class="grid gap-3" aria-describedby="material-variants-hint">
			<legend class="mb-1 text-sm font-medium">Varianten</legend>
			<p id="material-variants-hint" class="text-sm text-muted-foreground">
				Zum Beispiel die Längen eines Seils. Jede Variante braucht einen eigenen Namen, z. B. „15
				m“.
				{#if bulk && id}Erfasste Einkäufe erhöhen den Bestand automatisch.{/if}
				{#if form.variants.some(hasItems)}
					Varianten mit Gegenständen lassen sich erst entfernen, wenn ihre Gegenstände gelöscht oder
					einer anderen Variante zugeordnet sind.
				{/if}
			</p>
			{#if bulk}
				<div
					class="hidden gap-2 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[1fr_5rem_5rem_2rem]"
					aria-hidden="true"
				>
					<span>Name</span><span>Bestand</span><span>Beschädigt</span>
				</div>
			{/if}
			{#each form.variants as variant, v (variant)}
				{@const label = variant.name.trim() || `Variante ${v + 1}`}
				<!-- A card on phones, a row from sm on. -->
				<div
					class={[
						'grid gap-2 rounded-md border p-3 sm:items-end sm:rounded-none sm:border-0 sm:p-0',
						bulk ? 'grid-cols-2 sm:grid-cols-[1fr_5rem_5rem_2rem]' : 'grid-cols-[1fr_2rem]'
					]}
				>
					<div class={['grid gap-1', bulk && 'col-span-2 sm:col-span-1']}>
						<Label for="variant-{v}-name" class="text-xs sm:sr-only"
							>Name von Variante {v + 1}</Label
						>
						<div class="flex gap-2">
							<Input
								id="variant-{v}-name"
								bind:value={variant.name}
								required={form.variants.length > 1}
								maxlength={100}
								placeholder={v === 0 ? 'z. B. 10 m' : 'z. B. 15 m'}
								aria-invalid={(submitted && !!variantsError && !variant.name.trim()) || undefined}
								aria-describedby={submitted && variantsError
									? 'material-variants-error'
									: undefined}
							/>
							{#if bulk}
								<!-- On phones, the remove button sits next to the name. -->
								<Button
									variant="ghost"
									size="icon"
									class="sm:hidden"
									aria-label="{label} entfernen"
									title="Entfernen"
									disabled={form.variants.length === 1}
									onclick={() => removeVariant(variant)}
								>
									<XIcon />
								</Button>
							{/if}
						</div>
					</div>
					{#if bulk}
						<div class="grid gap-1">
							<Label for="variant-{v}-available" class="text-xs sm:sr-only"
								>Bestand von {label}</Label
							>
							<Input
								id="variant-{v}-available"
								type="number"
								min={0}
								required
								bind:value={variant.availableCount}
							/>
						</div>
						<div class="grid gap-1">
							<Label for="variant-{v}-damaged" class="text-xs sm:sr-only"
								>Beschädigt von {label}</Label
							>
							<Input
								id="variant-{v}-damaged"
								type="number"
								min={0}
								required
								bind:value={variant.damagedCount}
							/>
						</div>
					{/if}
					<Button
						variant="ghost"
						size="icon"
						class={bulk ? 'hidden sm:inline-flex' : ''}
						aria-label="{label} entfernen"
						title={hasItems(variant)
							? 'Hat noch Gegenstände – lösche sie zuerst oder ordne sie einer anderen Variante zu'
							: 'Entfernen'}
						disabled={form.variants.length === 1 || hasItems(variant)}
						onclick={() => removeVariant(variant)}
					>
						<XIcon />
					</Button>
					{#if bulk && !sharedLocation}
						<div class="col-span-2 grid grid-cols-2 gap-2 sm:col-span-4">
							{@render locationFields(variant, `-${v}`)}
						</div>
					{/if}
				</div>
			{/each}
			{#if submitted && variantsError}
				<p id="material-variants-error" class="text-sm text-destructive">{variantsError}</p>
			{/if}
			<div>
				<Button variant="outline" size="sm" onclick={addVariant}>
					<PlusIcon />Variante hinzufügen
				</Button>
			</div>
			{#if form.removed.length > 0}
				<p class="text-sm text-muted-foreground">
					Wird beim Speichern entfernt:
					{#each form.removed as variant, r (variant)}
						{r > 0 ? ', ' : ''}{savedNameOf(variant)}
						<Button
							variant="link"
							class="h-auto p-0"
							aria-label="Variante {savedNameOf(variant)} behalten"
							onclick={() => restoreVariant(variant)}>(behalten)</Button
						>
					{/each}
				</p>
			{/if}
		</fieldset>
		{#if bulk}
			<div class="flex items-center gap-2">
				<Switch
					id="material-location-per-variant"
					bind:checked={() => form.locationPerVariant, setLocationPerVariant}
				/>
				<Label for="material-location-per-variant">Lagerort je Variante</Label>
			</div>
			{#if sharedLocation}
				{@render locationFields(form, '')}
			{/if}
		{/if}
	{/if}
</FormDialog>

<ConfirmDelete bind:this={confirmRemove} />
