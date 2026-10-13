<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { api, mutate, type StorageLocation } from '#lib/api/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import LocationDialog from '#lib/components/LocationDialog.svelte';

	let { data } = $props();

	let locationDialog: LocationDialog;
	let confirmDelete: ConfirmDelete;

	function remove(location: StorageLocation) {
		confirmDelete.show(`location "${location.name}"`, () =>
			mutate(
				api.DELETE('/locations/{id}', { params: { path: { id: location.id } } }),
				`Deleted ${location.name}`
			)
		);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Locations</h1>
		<Button onclick={() => locationDialog.show()}><PlusIcon />Add location</Button>
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head>Description</Table.Head>
					<Table.Head class="w-20"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.locations as location (location.id)}
					<Table.Row>
						<Table.Cell class="font-medium">{location.name}</Table.Cell>
						<Table.Cell class="whitespace-normal text-muted-foreground"
							>{location.description ?? ''}</Table.Cell
						>
						<Table.Cell class="text-right">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit"
								onclick={() => locationDialog.show(location)}
							>
								<PencilIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Delete"
								onclick={() => remove(location)}
							>
								<Trash2Icon />
							</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={3} class="py-8 text-center text-muted-foreground"
							>No locations yet.</Table.Cell
						>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	<p class="text-sm text-muted-foreground">
		Deleting a location keeps its materials and items, without a location.
	</p>
</div>

<LocationDialog bind:this={locationDialog} />
<ConfirmDelete bind:this={confirmDelete} />
