<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import {
		mutate,
		type IndividualItem,
		type IndividualMaterial,
		type ItemStatus,
		type StorageLocation
	} from '#lib/api/index.js';
	import { conditionLabels, formatDate, itemName, statusLabels, variantOf } from '#lib/format.js';
	import { availableNow } from '#lib/settings.svelte.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from './ConfirmDelete.svelte';
	import DamageDialog from './DamageDialog.svelte';
	import ItemDialog from './ItemDialog.svelte';
	import RowActions from './RowActions.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const canEdit = $derived(tenant.can('EDIT'));

	let {
		material,
		items,
		locations
	}: {
		material: IndividualMaterial;
		/** The material's items, of all its variants. */
		items: IndividualItem[];
		locations: StorageLocation[];
	} = $props();

	let itemDialog: ItemDialog;
	let damageDialog: DamageDialog;
	let confirmDelete: ConfirmDelete;

	const sortedItems = $derived(
		items.toSorted((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))
	);
	/**
	 * With several variants, the items are grouped by variant (Material → Variante → Gegenstände), in the order of
	 * the variants; with one, they are listed without a heading.
	 */
	const several = $derived(material.variants.length > 1);
	const sections = $derived(
		material.variants.map((variant) => ({
			variant,
			items: sortedItems.filter((item) => item.variantId === variant.id)
		}))
	);

	const nameOf = (item: IndividualItem) =>
		itemName(material, variantOf(material, item.variantId), item);
	const locationOf = (item: IndividualItem) =>
		[item.storageLocation?.name, item.locationDetail].filter(Boolean).join(', ');

	/** Changes the status of [item] in one click, with "Undo" in the toast. */
	function setStatus(item: IndividualItem, status: ItemStatus) {
		// Bound now, so "Undo" in the toast still goes to this tenant after switching to another one.
		const client = api;
		const put = (status: ItemStatus) =>
			client.PUT('/items/{id}', {
				params: { path: { id: item.id } },
				body: {
					variantId: item.variantId,
					identifier: item.identifier,
					condition: item.condition,
					status,
					storageLocationId: item.storageLocation?.id ?? null,
					locationDetail: item.locationDetail,
					purchasePrice: item.purchasePrice,
					purchaseDate: item.purchaseDate
				}
			});
		return mutate(put(status), `${nameOf(item)}: ${statusLabels[status]}`, {
			undo: () => put(item.status)
		});
	}

	function remove(item: IndividualItem) {
		confirmDelete.show(nameOf(item), () =>
			mutate(
				api.DELETE('/items/{id}', { params: { path: { id: item.id } } }),
				`${nameOf(item)} gelöscht`
			)
		);
	}
</script>

{#snippet addButton(variant: 'default' | 'outline')}
	<Button {variant} size="sm" onclick={() => itemDialog.show()}>
		<PlusIcon />Gegenstände hinzufügen
	</Button>
{/snippet}

{#snippet itemRow(item: IndividualItem)}
	{@const retired = item.status === 'LOST' || item.status === 'DECOMMISSIONED'}
	<Table.Row class={retired ? 'text-muted-foreground' : ''}>
		<Table.Cell class={['whitespace-normal', several && 'sm:pl-6']}>
			<span class="font-medium">{item.identifier}</span>
			{#if item.onLoan}<Badge variant="secondary">ausgeliehen</Badge>{/if}
			<!-- On phones the other columns are hidden and shown here instead. -->
			<div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:hidden">
				<Badge variant={item.condition === 'POOR' ? 'destructive' : 'outline'}>
					{conditionLabels[item.condition]}
				</Badge>
				{statusLabels[item.status]}
				{#if locationOf(item)}<span class="text-muted-foreground">· {locationOf(item)}</span>{/if}
			</div>
		</Table.Cell>
		<Table.Cell class="hidden sm:table-cell">
			<Badge variant={item.condition === 'POOR' ? 'destructive' : 'outline'}>
				{conditionLabels[item.condition]}
			</Badge>
		</Table.Cell>
		<Table.Cell class="hidden sm:table-cell">{statusLabels[item.status]}</Table.Cell>
		<Table.Cell class="hidden whitespace-normal sm:table-cell">
			{locationOf(item) || '—'}
		</Table.Cell>
		<Table.Cell class="hidden md:table-cell">{formatDate(item.purchaseDate)}</Table.Cell>
		<Table.Cell class="text-right">
			<RowActions
				name={nameOf(item)}
				onedit={canEdit ? () => itemDialog.show(item) : undefined}
				actions={[
					{
						label: 'Schaden melden',
						icon: TriangleAlertIcon,
						onselect: () => damageDialog.show(item, nameOf(item))
					},
					...(!canEdit || item.status === 'DECOMMISSIONED'
						? []
						: [
								{
									label: 'Ausmustern',
									icon: ArchiveIcon,
									onselect: () => setStatus(item, 'DECOMMISSIONED')
								}
							]),
					...(canEdit
						? [
								{
									label: 'Löschen',
									icon: Trash2Icon,
									destructive: true,
									disabled: item.hasHistory,
									hint: item.hasHistory
										? 'Hat Schadensmeldungen oder Ausleihen. Mustere ihn stattdessen aus.'
										: undefined,
									onselect: () => remove(item)
								}
							]
						: [])
				]}
			/>
		</Table.Cell>
	</Table.Row>
{/snippet}

<div class="space-y-2">
	<div class="rounded-md border bg-background">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Kennung</Table.Head>
					<Table.Head class="hidden sm:table-cell">Zustand</Table.Head>
					<Table.Head class="hidden sm:table-cell">Status</Table.Head>
					<Table.Head class="hidden sm:table-cell">Lagerort</Table.Head>
					<Table.Head class="hidden md:table-cell">Gekauft</Table.Head>
					<Table.Head class="w-20"><span class="sr-only">Aktionen</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if several}
					{#each sections as { variant, items: variantItems } (variant.id)}
						<Table.Row class="bg-muted/50 hover:bg-muted/50">
							<Table.Cell colspan={6} class="whitespace-normal">
								<div class="flex flex-wrap items-center justify-between gap-2">
									<h3 class="font-medium">
										{variant.name}
										<span class="font-normal text-muted-foreground tabular-nums"
											>· {availableNow(variant)} verfügbar</span
										>
									</h3>
									{#if canEdit}
										<Button
											variant="ghost"
											size="sm"
											class="h-7"
											aria-label="Gegenstände zu {material.name} {variant.name} hinzufügen"
											onclick={() => itemDialog.show(undefined, variant.id)}
										>
											<PlusIcon />Hinzufügen
										</Button>
									{/if}
								</div>
							</Table.Cell>
						</Table.Row>
						{#each variantItems as item (item.id)}
							{@render itemRow(item)}
						{:else}
							<Table.Row>
								<Table.Cell colspan={6} class="text-muted-foreground sm:pl-6">
									Noch keine Gegenstände.
								</Table.Cell>
							</Table.Row>
						{/each}
					{/each}
				{:else}
					{#each sortedItems as item (item.id)}
						{@render itemRow(item)}
					{:else}
						<Table.Row>
							<Table.Cell colspan={6} class="py-6 text-center whitespace-normal">
								<p class="text-muted-foreground">{material.name} hat noch keine Gegenstände.</p>
								{#if canEdit}<div class="mt-3">{@render addButton('default')}</div>{/if}
							</Table.Cell>
						</Table.Row>
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>
	{#if canEdit && items.length > 0}
		{@render addButton('outline')}
	{/if}
</div>

<ItemDialog bind:this={itemDialog} {material} {items} {locations} />
<DamageDialog bind:this={damageDialog} />
<ConfirmDelete bind:this={confirmDelete} />
