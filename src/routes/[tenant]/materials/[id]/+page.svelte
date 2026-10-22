<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { mutate, type BulkVariant, type DamageReport, type Purchase } from '#lib/api/index.js';
	import { formatDate, formatPrice, itemName, trackingTypeLabels } from '#lib/format.js';
	import { isAvailableItem } from '#lib/loans.js';
	import { availableNow, settings } from '#lib/settings.svelte.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import DamageDialog from '#lib/components/DamageDialog.svelte';
	import ItemTable from '#lib/components/ItemTable.svelte';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';
	import MaterialDialog from '#lib/components/MaterialDialog.svelte';
	import PurchaseDialog from '#lib/components/PurchaseDialog.svelte';
	import RowActions from '#lib/components/RowActions.svelte';

	let { data } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const canEdit = $derived(tenant.can('EDIT'));
	const material = $derived(data.material);
	const items = $derived(new Map(data.items.map((item) => [item.id, item])));
	/** With several variants, a table breaks the counts down by variant. */
	const several = $derived(material.variants.length > 1);
	/** The location of a bulk material with a single variant; several variants show theirs in the table. */
	const bulkLocation = $derived.by(() => {
		if (material.trackingType !== 'BULK' || several) return undefined;
		const [variant] = material.variants;
		return variant?.location ? { ...variant.location, detail: variant.locationDetail } : undefined;
	});
	/** Open reports first, each group newest first (as returned by the API). */
	const damages = $derived(
		data.damages.toSorted((a, b) => Number(a.resolvedAt != null) - Number(b.resolvedAt != null))
	);
	const openDamages = $derived(damages.filter((report) => !report.resolvedAt).length);
	/** Lent pieces of an individual material that were lent as a quantity, so no item is marked as lent. */
	const lentByQuantity = $derived(
		material.loanedCount - data.items.filter((item) => item.onLoan && isAvailableItem(item)).length
	);

	const counts = $derived([
		{
			label: 'Im Bestand',
			value: material.availableCount,
			hint: 'einsatzbereit, auch ausgeliehene'
		},
		{
			label: 'Ausgeliehen',
			value: material.loanedCount,
			hint:
				material.trackingType === 'INDIVIDUAL' && lentByQuantity > 0
					? `davon ${lentByQuantity} nur als Anzahl`
					: undefined
		},
		{
			label: 'Verfügbar',
			value: availableNow(material),
			hint: settings.subtractLoaned ? 'im Lager' : 'ausgeliehene mitgezählt'
		},
		{
			label: 'Beschädigt',
			value: material.damagedCount,
			hint: material.trackingType === 'INDIVIDUAL' ? 'schlecht oder in Reparatur' : undefined
		}
	]);

	let materialDialog: MaterialDialog;
	let damageDialog: DamageDialog;
	// Only rendered for bulk materials.
	let purchaseDialog = $state<PurchaseDialog>();
	let confirmDelete: ConfirmDelete;

	const path = (id: string) => ({ params: { path: { id } } });

	function variantOf(variantId: string) {
		return material.variants.find((variant) => variant.id === variantId) ?? { name: null };
	}

	function reportName(report: DamageReport) {
		const item = items.get(report.itemId);
		return item ? itemName(material, variantOf(item.variantId), item) : `${material.name} ?`;
	}

	function removeMaterial() {
		confirmDelete.show(`Material „${material.name}“`, () =>
			mutate(api.DELETE('/materials/{id}', path(material.id)), `${material.name} gelöscht`, {
				redirectTo: tenant.href('')
			})
		);
	}

	function removeDamage(report: DamageReport) {
		confirmDelete.show(`Schadensmeldung zu ${reportName(report)}`, () =>
			mutate(api.DELETE('/damages/{id}', path(report.id)), 'Schadensmeldung gelöscht')
		);
	}

	function removePurchase(purchase: Purchase) {
		const date = purchase.purchaseDate ? ` vom ${formatDate(purchase.purchaseDate)}` : '';
		confirmDelete.show(`Einkauf${date} (${purchase.quantity} Stück)`, () =>
			mutate(
				api.DELETE('/purchases/{id}', path(purchase.id)),
				`Einkauf gelöscht, Bestand um ${purchase.quantity} verringert`
			)
		);
	}
</script>

<div class="space-y-6">
	<div class="space-y-4">
		<a
			href={tenant.href('')}
			class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />Materialien
		</a>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">{material.name}</h1>
				<p class="text-muted-foreground">
					{[trackingTypeLabels[material.trackingType], material.category, material.description]
						.filter(Boolean)
						.join(' · ')}
				</p>
				{#if bulkLocation}
					<p class="text-sm">
						Lagert in
						<a
							href={tenant.href(`/locations/${bulkLocation.id}`)}
							class="underline-offset-4 hover:underline">{bulkLocation.name}</a
						>{bulkLocation.detail ? `, ${bulkLocation.detail}` : ''}
					</p>
				{/if}
			</div>
			{#if canEdit}
				<div class="flex gap-2">
					<Button variant="outline" onclick={() => materialDialog.show(material)}>
						<PencilIcon />Bearbeiten
					</Button>
					<Button
						variant="outline"
						size="icon"
						aria-label="{material.name} löschen"
						title="Löschen"
						onclick={removeMaterial}
					>
						<Trash2Icon />
					</Button>
				</div>
			{/if}
		</div>

		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#each counts as count (count.label)}
				<div class="rounded-md border p-3">
					<dt class="text-sm text-muted-foreground">{count.label}</dt>
					<dd class="text-2xl font-semibold tabular-nums">{count.value}</dd>
					{#if count.hint}<dd class="text-xs text-muted-foreground">{count.hint}</dd>{/if}
				</div>
			{/each}
		</dl>
		<LoanedToggle />
	</div>

	{#if several}
		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Varianten</h2>
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Name</Table.Head>
							<Table.Head class="text-right">Bestand</Table.Head>
							<Table.Head class="hidden text-right sm:table-cell">Ausgeliehen</Table.Head>
							<Table.Head class="text-right">Verfügbar</Table.Head>
							<Table.Head class="text-right">Beschädigt</Table.Head>
							{#if material.trackingType === 'BULK'}
								<Table.Head class="hidden sm:table-cell">Lagerort</Table.Head>
							{/if}
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each material.variants as variant (variant.id)}
							<Table.Row>
								<Table.Cell class="font-medium whitespace-normal">{variant.name}</Table.Cell>
								<Table.Cell class="text-right tabular-nums">{variant.availableCount}</Table.Cell>
								<Table.Cell class="hidden text-right tabular-nums sm:table-cell"
									>{variant.loanedCount}</Table.Cell
								>
								<Table.Cell class="text-right tabular-nums">{availableNow(variant)}</Table.Cell>
								<Table.Cell class="text-right tabular-nums">{variant.damagedCount}</Table.Cell>
								{#if material.trackingType === 'BULK'}
									{@const { location, locationDetail } = variant as BulkVariant}
									<Table.Cell class="hidden whitespace-normal sm:table-cell">
										{#if location}
											<a
												href={tenant.href(`/locations/${location.id}`)}
												class="underline-offset-4 hover:underline">{location.name}</a
											>{locationDetail ? `, ${locationDetail}` : ''}
										{:else}
											—
										{/if}
									</Table.Cell>
								{/if}
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</section>
	{/if}

	{#if material.trackingType === 'INDIVIDUAL'}
		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Gegenstände</h2>
			<ItemTable {material} items={data.items} locations={data.locations} />
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">
				Schadensmeldungen
				{#if openDamages > 0}<span class="font-normal text-muted-foreground"
						>({openDamages} offen)</span
					>{/if}
			</h2>
			{#each damages as report (report.id)}
				<div
					class={[
						'flex items-start justify-between gap-4 rounded-md border p-3',
						report.resolvedAt && 'text-muted-foreground'
					]}
				>
					<div class="space-y-1">
						<p>
							<span class="font-medium">{reportName(report)}:</span>
							{report.description}
						</p>
						<p class="text-sm text-muted-foreground">
							{#if report.resolvedAt}
								<Badge variant="secondary">behoben</Badge>
							{:else}
								<Badge variant="outline" class="border-destructive/50 text-destructive">offen</Badge
								>
							{/if}
							Gemeldet am {formatDate(report.reportedAt)}{report.reportedBy
								? ` von ${report.reportedBy}`
								: ''}
							{#if report.resolvedAt}
								· behoben am {formatDate(report.resolvedAt)}{report.resolutionNotes
									? `: ${report.resolutionNotes}`
									: ''}
							{/if}
						</p>
					</div>
					{#if canEdit && items.get(report.itemId)}
						<RowActions
							name="Schadensmeldung zu {reportName(report)}"
							onedit={() =>
								damageDialog.show(items.get(report.itemId)!, reportName(report), report)}
							actions={[
								{
									label: 'Löschen',
									icon: Trash2Icon,
									destructive: true,
									onselect: () => removeDamage(report)
								}
							]}
						/>
					{/if}
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">Keine Schäden gemeldet.</p>
			{/each}
		</section>
	{:else}
		<section class="space-y-2">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold">Einkäufe</h2>
				{#if canEdit}
					<Button size="sm" onclick={() => purchaseDialog?.show()}
						><PlusIcon />Einkauf erfassen</Button
					>
				{/if}
			</div>
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Datum</Table.Head>
							{#if several}<Table.Head>Variante</Table.Head>{/if}
							<Table.Head class="text-right">Menge</Table.Head>
							<Table.Head class="text-right">Stückpreis</Table.Head>
							<Table.Head class="hidden sm:table-cell">Notiz</Table.Head>
							<Table.Head class="w-20"><span class="sr-only">Aktionen</span></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.purchases as purchase (purchase.id)}
							<Table.Row>
								<Table.Cell>{formatDate(purchase.purchaseDate)}</Table.Cell>
								{#if several}
									<Table.Cell class="whitespace-normal"
										>{variantOf(purchase.variantId).name}</Table.Cell
									>
								{/if}
								<Table.Cell class="text-right tabular-nums">{purchase.quantity}</Table.Cell>
								<Table.Cell class="text-right tabular-nums"
									>{formatPrice(purchase.unitPrice)}</Table.Cell
								>
								<Table.Cell class="hidden whitespace-normal sm:table-cell"
									>{purchase.note ?? ''}</Table.Cell
								>
								<Table.Cell class="text-right">
									{#if canEdit}
										<RowActions
											name="Einkauf vom {formatDate(purchase.purchaseDate)}"
											onedit={() => purchaseDialog?.show(purchase)}
											actions={[
												{
													label: 'Löschen',
													icon: Trash2Icon,
													destructive: true,
													onselect: () => removePurchase(purchase)
												}
											]}
										/>
									{/if}
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell
									colspan={several ? 6 : 5}
									class="py-6 text-center text-muted-foreground"
								>
									Noch keine Einkäufe erfasst.
								</Table.Cell>
							</Table.Row>
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</section>
	{/if}
</div>

<MaterialDialog bind:this={materialDialog} locations={data.locations} />
<DamageDialog bind:this={damageDialog} />
{#if material.trackingType === 'BULK'}
	<PurchaseDialog bind:this={purchaseDialog} {material} />
{/if}
<ConfirmDelete bind:this={confirmDelete} />
