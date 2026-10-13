<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import { api, mutate, type IndividualItem, type StorageLocation } from '#lib/api/index.js';
	import { conditionLabels, formatDate, statusLabels } from '#lib/format.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from './ConfirmDelete.svelte';
	import DamageDialog from './DamageDialog.svelte';
	import ItemDialog from './ItemDialog.svelte';

	let {
		materialId,
		items,
		locations
	}: { materialId: string; items: IndividualItem[]; locations: StorageLocation[] } = $props();

	let itemDialog: ItemDialog;
	let damageDialog: DamageDialog;
	let confirmDelete: ConfirmDelete;

	const sortedItems = $derived(
		items.toSorted((a, b) => a.identifier.localeCompare(b.identifier, undefined, { numeric: true }))
	);

	function remove(item: IndividualItem) {
		confirmDelete.show(`item "${item.identifier}"`, () =>
			mutate(
				api.DELETE('/items/{id}', { params: { path: { id: item.id } } }),
				`Deleted ${item.identifier}`
			)
		);
	}
</script>

<div class="space-y-2">
	<div class="rounded-md border bg-background">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Identifier</Table.Head>
					<Table.Head>Condition</Table.Head>
					<Table.Head>Status</Table.Head>
					<Table.Head>Location</Table.Head>
					<Table.Head class="hidden md:table-cell">Purchased</Table.Head>
					<Table.Head class="w-28"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each sortedItems as item (item.id)}
					<Table.Row>
						<Table.Cell class="font-medium">
							{item.identifier}
							{#if item.onLoan}<Badge variant="secondary">lent out</Badge>{/if}
						</Table.Cell>
						<Table.Cell>
							<Badge variant={item.condition === 'POOR' ? 'destructive' : 'outline'}>
								{conditionLabels[item.condition]}
							</Badge>
						</Table.Cell>
						<Table.Cell>{statusLabels[item.status]}</Table.Cell>
						<Table.Cell class="whitespace-normal">
							{[item.storageLocation?.name, item.locationDetail].filter(Boolean).join(', ') || '—'}
						</Table.Cell>
						<Table.Cell class="hidden md:table-cell">{formatDate(item.purchaseDate)}</Table.Cell>
						<Table.Cell class="text-right whitespace-nowrap">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Report damage"
								title="Report damage"
								onclick={() => damageDialog.show(item.id)}
							>
								<TriangleAlertIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit"
								onclick={() => itemDialog.show(item)}
							>
								<PencilIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Delete"
								onclick={() => remove(item)}
							>
								<Trash2Icon />
							</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={6} class="py-6 text-center text-muted-foreground">
							No items yet.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	<Button variant="outline" size="sm" onclick={() => itemDialog.show()}><PlusIcon />Add item</Button
	>
</div>

<ItemDialog bind:this={itemDialog} {materialId} {locations} />
<DamageDialog bind:this={damageDialog} />
<ConfirmDelete bind:this={confirmDelete} />
