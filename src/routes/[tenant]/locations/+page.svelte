<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { mutate, type StorageLocation } from '#lib/api/index.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import LocationDialog from '#lib/components/LocationDialog.svelte';
	import RowActions from '#lib/components/RowActions.svelte';

	let { data } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const canEdit = $derived(tenant.can('EDIT'));

	let locationDialog: LocationDialog;
	let confirmDelete: ConfirmDelete;

	function remove(location: StorageLocation) {
		confirmDelete.show(`Lagerort „${location.name}“`, () =>
			mutate(
				api.DELETE('/locations/{id}', { params: { path: { id: location.id } } }),
				`${location.name} gelöscht`
			)
		);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Lagerorte</h1>
		{#if canEdit}
			<Button onclick={() => locationDialog.show()}><PlusIcon />Lagerort anlegen</Button>
		{/if}
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head class="hidden sm:table-cell">Beschreibung</Table.Head>
					<Table.Head><span class="sr-only">Aktionen</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.locations as location (location.id)}
					<Table.Row>
						<Table.Cell class="whitespace-normal">
							<a
								href={tenant.href(`/locations/${location.id}`)}
								class="font-medium hover:underline"
							>
								{location.name}
							</a>
							{#if location.description}
								<p class="text-sm text-muted-foreground sm:hidden">{location.description}</p>
							{/if}
						</Table.Cell>
						<Table.Cell class="hidden whitespace-normal text-muted-foreground sm:table-cell">
							{location.description ?? ''}
						</Table.Cell>
						<Table.Cell class="text-right">
							{#if canEdit}
								<RowActions
									name={location.name}
									onedit={() => locationDialog.show(location)}
									actions={[
										{
											label: 'Löschen',
											icon: Trash2Icon,
											destructive: true,
											onselect: () => remove(location)
										}
									]}
								/>
							{/if}
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={3} class="py-8 text-center text-muted-foreground">
							Noch keine Lagerorte.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
	<p class="text-sm text-muted-foreground">
		Wenn du einen Lagerort löschst, bleiben seine Materialien und Gegenstände erhalten, nur ohne
		Lagerort.
	</p>
</div>

<LocationDialog bind:this={locationDialog} />
<ConfirmDelete bind:this={confirmDelete} />
