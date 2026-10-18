<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { SvelteSet } from 'svelte/reactivity';
	import { mutate, type IndividualItem, type Material } from '#lib/api/index.js';
	import { trackingTypeLabels } from '#lib/format.js';
	import { availableNow } from '#lib/settings.svelte.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import ItemTable from '#lib/components/ItemTable.svelte';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';
	import MaterialDialog from '#lib/components/MaterialDialog.svelte';
	import RowActions from '#lib/components/RowActions.svelte';

	let { data } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const canEdit = $derived(tenant.can('EDIT'));

	type SortKey = 'name' | 'category' | 'location' | 'available' | 'damaged' | 'loaned';

	let query = $state('');
	let sort = $state<{ key: SortKey; descending: boolean }>({ key: 'name', descending: false });
	const expanded = new SvelteSet<string>();
	let materialDialog: MaterialDialog;
	let confirmDelete: ConfirmDelete;

	const itemsByMaterial = $derived(
		data.items.reduce<Record<string, IndividualItem[]>>((byMaterial, item) => {
			(byMaterial[item.materialId] ??= []).push(item);
			return byMaterial;
		}, {})
	);

	/** Where a material is stored: its location for bulk materials, the distinct item locations otherwise. */
	function locationOf(material: Material): string {
		if (material.trackingType === 'BULK') {
			return [material.location?.name, material.locationDetail].filter(Boolean).join(', ');
		}
		const names = (itemsByMaterial[material.id] ?? []).map((item) => item.storageLocation?.name);
		return [...new Set(names.filter(Boolean))].sort().join(', ');
	}

	const sortValues: Record<SortKey, (material: Material) => string | number> = {
		name: (m) => m.name,
		category: (m) => m.category ?? '',
		location: locationOf,
		available: availableNow,
		damaged: (m) => m.damagedCount,
		loaned: (m) => m.loanedCount
	};

	const materials = $derived.by(() => {
		const q = query.trim().toLowerCase();
		const value = sortValues[sort.key];
		const direction = sort.descending ? -1 : 1;
		return data.materials
			.filter((material) =>
				[material.name, material.category, material.description, locationOf(material)].some(
					(text) => text?.toLowerCase().includes(q)
				)
			)
			.toSorted((a, b) => {
				const [x, y] = [value(a), value(b)];
				const order =
					typeof x === 'number' && typeof y === 'number'
						? x - y
						: String(x).localeCompare(String(y), undefined, { numeric: true });
				return order * direction || a.name.localeCompare(b.name);
			});
	});

	function sortBy(key: SortKey) {
		sort = { key, descending: sort.key === key && !sort.descending };
	}

	function toggle(materialId: string) {
		if (!expanded.delete(materialId)) expanded.add(materialId);
	}

	function remove(material: Material) {
		confirmDelete.show(`Material „${material.name}“`, () =>
			mutate(
				api.DELETE('/materials/{id}', { params: { path: { id: material.id } } }),
				`${material.name} gelöscht`
			)
		);
	}
</script>

{#snippet sortable(key: SortKey, label: string)}
	<button class="inline-flex items-center gap-1 hover:text-foreground" onclick={() => sortBy(key)}>
		{label}
		{#if sort.key === key}
			{#if sort.descending}<ArrowDownIcon class="size-3.5" />{:else}<ArrowUpIcon
					class="size-3.5"
				/>{/if}
		{/if}
	</button>
{/snippet}

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Materialien</h1>
		{#if canEdit}
			<Button onclick={() => materialDialog.show()}><PlusIcon />Material anlegen</Button>
		{/if}
	</div>

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
		<div class="relative flex-1">
			<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				aria-label="Materialien durchsuchen"
				placeholder="Name, Kategorie, Beschreibung, Lagerort…"
				class="pl-9"
				bind:value={query}
			/>
		</div>
		<LoanedToggle />
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head class="w-8"><span class="sr-only">Gegenstände</span></Table.Head>
					<Table.Head>{@render sortable('name', 'Name')}</Table.Head>
					<Table.Head class="hidden md:table-cell"
						>{@render sortable('category', 'Kategorie')}</Table.Head
					>
					<Table.Head class="hidden lg:table-cell">Erfassung</Table.Head>
					<Table.Head class="hidden sm:table-cell"
						>{@render sortable('location', 'Lagerort')}</Table.Head
					>
					<Table.Head class="text-right">{@render sortable('available', 'Verfügbar')}</Table.Head>
					<Table.Head class="hidden text-right sm:table-cell">
						{@render sortable('damaged', 'Beschädigt')}
					</Table.Head>
					<Table.Head class="hidden text-right sm:table-cell">
						{@render sortable('loaned', 'Ausgeliehen')}
					</Table.Head>
					<Table.Head class="w-20"><span class="sr-only">Aktionen</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each materials as material (material.id)}
					{@const isOpen = expanded.has(material.id)}
					<Table.Row>
						<Table.Cell class="pr-0">
							{#if material.trackingType === 'INDIVIDUAL'}
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label={isOpen
										? `Gegenstände von ${material.name} ausblenden`
										: `Gegenstände von ${material.name} anzeigen`}
									aria-expanded={isOpen}
									onclick={() => toggle(material.id)}
								>
									{#if isOpen}<ChevronDownIcon />{:else}<ChevronRightIcon />{/if}
								</Button>
							{/if}
						</Table.Cell>
						<Table.Cell class="whitespace-normal">
							<a href={tenant.href(`/materials/${material.id}`)} class="font-medium hover:underline"
								>{material.name}</a
							>
							{#if material.description}
								<p class="text-sm text-muted-foreground">{material.description}</p>
							{/if}
							{#if locationOf(material)}
								<p class="text-sm text-muted-foreground sm:hidden">{locationOf(material)}</p>
							{/if}
						</Table.Cell>
						<Table.Cell class="hidden md:table-cell">
							{#if material.category}<Badge variant="outline">{material.category}</Badge>{/if}
						</Table.Cell>
						<Table.Cell class="hidden text-muted-foreground lg:table-cell">
							{trackingTypeLabels[material.trackingType]}
						</Table.Cell>
						<Table.Cell class="hidden whitespace-normal sm:table-cell">
							{locationOf(material) || '—'}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{availableNow(material)}</Table.Cell>
						<Table.Cell class="hidden text-right tabular-nums sm:table-cell">
							{material.damagedCount}
						</Table.Cell>
						<Table.Cell class="hidden text-right tabular-nums sm:table-cell">
							{material.loanedCount}
						</Table.Cell>
						<Table.Cell class="text-right">
							{#if canEdit}
								<RowActions
									name={material.name}
									onedit={() => materialDialog.show(material)}
									actions={[
										{
											label: 'Löschen',
											icon: Trash2Icon,
											destructive: true,
											onselect: () => remove(material)
										}
									]}
								/>
							{/if}
						</Table.Cell>
					</Table.Row>
					{#if isOpen}
						<Table.Row class="hover:bg-transparent">
							<Table.Cell colspan={9} class="bg-muted/30 p-3 whitespace-normal sm:pl-10">
								<ItemTable
									{material}
									items={itemsByMaterial[material.id] ?? []}
									locations={data.locations}
								/>
							</Table.Cell>
						</Table.Row>
					{/if}
				{:else}
					<Table.Row>
						<Table.Cell colspan={9} class="py-8 text-center text-muted-foreground">
							{query ? `Keine Materialien zu „${query}“ gefunden.` : 'Noch keine Materialien.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<MaterialDialog bind:this={materialDialog} locations={data.locations} />
<ConfirmDelete bind:this={confirmDelete} />
