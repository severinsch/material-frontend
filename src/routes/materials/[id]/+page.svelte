<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { api, mutate } from '#lib/api/index.js';
	import { formatDate, trackingTypeLabels } from '#lib/format.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import DamageDialog from '#lib/components/DamageDialog.svelte';
	import ItemTable from '#lib/components/ItemTable.svelte';
	import MaterialDialog from '#lib/components/MaterialDialog.svelte';
	import PurchaseDialog from '#lib/components/PurchaseDialog.svelte';

	let { data } = $props();
	const material = $derived(data.material);
	const identifiers = $derived(new Map(data.items.map((item) => [item.id, item.identifier])));

	let materialDialog: MaterialDialog;
	let damageDialog: DamageDialog;
	let purchaseDialog: PurchaseDialog;
	let confirmDelete: ConfirmDelete;

	const path = (id: string) => ({ params: { path: { id } } });

	function removeMaterial() {
		confirmDelete.show(`material "${material.name}"`, () =>
			mutate(api.DELETE('/materials/{id}', path(material.id)), `Deleted ${material.name}`, '/')
		);
	}
</script>

<div class="space-y-6">
	<div class="space-y-2">
		<a href="/" class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
			<ArrowLeftIcon class="size-4" />Materials
		</a>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">{material.name}</h1>
				<p class="text-muted-foreground">
					{[trackingTypeLabels[material.trackingType], material.category, material.description]
						.filter(Boolean)
						.join(' · ')}
				</p>
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={() => materialDialog.show(material)}
					><PencilIcon />Edit</Button
				>
				<Button variant="outline" aria-label="Delete" onclick={removeMaterial}
					><Trash2Icon /></Button
				>
			</div>
		</div>
		<p class="text-sm">
			{material.availableCount} available · {material.damagedCount} damaged · {material.loanedCount} lent
			out
			{#if material.trackingType === 'BULK' && material.location}
				· stored in {material.location.name}{material.locationDetail
					? `, ${material.locationDetail}`
					: ''}
			{/if}
		</p>
	</div>

	{#if material.trackingType === 'INDIVIDUAL'}
		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Items</h2>
			<ItemTable materialId={material.id} items={data.items} locations={data.locations} />
			<p class="text-sm text-muted-foreground">
				Items with damage reports or loans can't be deleted. Set their status to "Decommissioned"
				instead.
			</p>
		</section>

		<section class="space-y-2">
			<h2 class="text-lg font-semibold">Damage reports</h2>
			{#each data.damages as report (report.id)}
				<div class="flex items-start justify-between gap-4 rounded-md border p-3">
					<div class="space-y-1">
						<p>
							<span class="font-medium">{identifiers.get(report.itemId)}:</span>
							{report.description}
							{#if report.resolvedAt}<Badge variant="secondary">resolved</Badge>{/if}
						</p>
						<p class="text-sm text-muted-foreground">
							Reported {formatDate(report.reportedAt)}{report.reportedBy
								? ` by ${report.reportedBy}`
								: ''}
							{#if report.resolvedAt}
								· resolved {formatDate(report.resolvedAt)}{report.resolutionNotes
									? `: ${report.resolutionNotes}`
									: ''}
							{/if}
						</p>
					</div>
					<div class="flex shrink-0">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Edit"
							onclick={() => damageDialog.show(report.itemId, report)}
						>
							<PencilIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Delete"
							onclick={() =>
								confirmDelete.show('damage report', () =>
									mutate(api.DELETE('/damages/{id}', path(report.id)), 'Deleted damage report')
								)}
						>
							<Trash2Icon />
						</Button>
					</div>
				</div>
			{:else}
				<p class="text-sm text-muted-foreground">No damage reported.</p>
			{/each}
		</section>
	{:else}
		<section class="space-y-2">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold">Purchases</h2>
				<Button size="sm" onclick={() => purchaseDialog.show()}><PlusIcon />Record purchase</Button>
			</div>
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head>Date</Table.Head>
							<Table.Head class="text-right">Quantity</Table.Head>
							<Table.Head class="text-right">Unit price</Table.Head>
							<Table.Head class="hidden sm:table-cell">Note</Table.Head>
							<Table.Head class="w-20"></Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each data.purchases as purchase (purchase.id)}
							<Table.Row>
								<Table.Cell>{formatDate(purchase.purchaseDate)}</Table.Cell>
								<Table.Cell class="text-right tabular-nums">{purchase.quantity}</Table.Cell>
								<Table.Cell class="text-right tabular-nums"
									>{purchase.unitPrice?.toFixed(2) ?? '—'}</Table.Cell
								>
								<Table.Cell class="hidden whitespace-normal sm:table-cell"
									>{purchase.note ?? ''}</Table.Cell
								>
								<Table.Cell class="text-right">
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label="Edit"
										onclick={() => purchaseDialog.show(purchase)}
									>
										<PencilIcon />
									</Button>
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label="Delete"
										onclick={() =>
											confirmDelete.show('purchase', () =>
												mutate(api.DELETE('/purchases/{id}', path(purchase.id)), 'Deleted purchase')
											)}
									>
										<Trash2Icon />
									</Button>
								</Table.Cell>
							</Table.Row>
						{:else}
							<Table.Row>
								<Table.Cell colspan={5} class="py-6 text-center text-muted-foreground">
									No purchases recorded.
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
<PurchaseDialog bind:this={purchaseDialog} materialId={material.id} />
<ConfirmDelete bind:this={confirmDelete} />
