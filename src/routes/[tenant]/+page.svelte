<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import MergeIcon from '@lucide/svelte/icons/merge';
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
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import ItemTable from '#lib/components/ItemTable.svelte';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';
	import MaterialDialog from '#lib/components/MaterialDialog.svelte';
	import MergeDialog from '#lib/components/MergeDialog.svelte';
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
	let mergeDialog: MergeDialog;
	let confirmDelete: ConfirmDelete;

	/** Whether materials are being selected to merge them; the first selected is the target. */
	let selecting = $state(false);
	let selectedIds = $state<string[]>([]);
	/** The selected materials in the order selected, without any deleted meanwhile. */
	const selected = $derived(
		selectedIds.flatMap((id) => data.materials.find((material) => material.id === id) ?? [])
	);
	/** Only materials of the same tracking type can be merged. */
	const selectableType = $derived(selected[0]?.trackingType);
	const columns = $derived(selecting ? 10 : 9);

	const itemsByMaterial = $derived(
		data.items.reduce<Record<string, IndividualItem[]>>((byMaterial, item) => {
			(byMaterial[item.materialId] ??= []).push(item);
			return byMaterial;
		}, {})
	);

	/**
	 * Where a material is stored: the location and place of its bulk variants if they share them, otherwise the
	 * distinct locations of the variants (bulk) or items (individual).
	 */
	function locationOf(material: Material): string {
		if (material.trackingType === 'BULK') {
			const places = new Set(
				material.variants.map((variant) =>
					[variant.location?.name, variant.locationDetail].filter(Boolean).join(', ')
				)
			);
			if (places.size === 1) return [...places][0];
			const names = material.variants.map((variant) => variant.location?.name);
			return [...new Set(names.filter(Boolean))].sort().join(', ');
		}
		const names = (itemsByMaterial[material.id] ?? []).map((item) => item.storageLocation?.name);
		return [...new Set(names.filter(Boolean))].sort().join(', ');
	}

	/** The available pieces per variant, e.g. "10 m: 4 · 15 m: 6", for materials with several variants. */
	function variantCounts(material: Material): string | undefined {
		if (material.variants.length < 2) return;
		return material.variants
			.map((variant) => `${variant.name}: ${availableNow(variant)}`)
			.join(' · ');
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
				[
					material.name,
					material.category,
					material.description,
					locationOf(material),
					...material.variants.map((variant) => variant.name)
				].some((text) => text?.toLowerCase().includes(q))
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

	function select(material: Material, checked: boolean) {
		selectedIds = checked
			? [...selectedIds, material.id]
			: selectedIds.filter((id) => id !== material.id);
	}

	function stopSelecting() {
		selecting = false;
		selectedIds = [];
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
	<div class="flex flex-wrap items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Materialien</h1>
		{#if canEdit}
			<div class="flex flex-wrap gap-2">
				{#if !selecting}
					<Button variant="outline" onclick={() => (selecting = true)}>
						<MergeIcon />Zusammenführen
					</Button>
				{/if}
				<Button onclick={() => materialDialog.show()}><PlusIcon />Material anlegen</Button>
			</div>
		{/if}
	</div>

	{#if selecting}
		<div
			class="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center"
			role="region"
			aria-label="Materialien zusammenführen"
		>
			<div class="flex-1 text-sm">
				{#if selected.length === 0}
					<p>
						Wähle die Materialien aus, die Varianten eines Materials werden sollen, z. B. Seil 10 m,
						Seil 15 m und Seil 20 m.
					</p>
				{:else}
					<p aria-live="polite">
						<span class="font-medium">{selected.length} ausgewählt:</span>
						{selected.map((material) => material.name).join(', ')}
					</p>
					<p class="text-muted-foreground">
						Dazu passen nur Materialien, die {selectableType === 'BULK' ? 'nach Menge' : 'einzeln'} erfasst
						werden.
					</p>
				{/if}
			</div>
			<div class="flex gap-2">
				<Button variant="outline" onclick={stopSelecting}>Abbrechen</Button>
				<Button disabled={selected.length < 2} onclick={() => mergeDialog.show(selected)}>
					Weiter
				</Button>
			</div>
		</div>
	{/if}

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
		<div class="relative flex-1">
			<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				aria-label="Materialien durchsuchen"
				placeholder="Name, Variante, Kategorie, Beschreibung, Lagerort…"
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
					{#if selecting}
						<Table.Head class="w-8"><span class="sr-only">Auswahl</span></Table.Head>
					{/if}
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
						{#if selecting}
							{@const otherType = !!selectableType && material.trackingType !== selectableType}
							<Table.Cell class="pr-0">
								<div
									class="flex size-8 items-center justify-center"
									title={otherType ? 'Andere Erfassungsart als die Auswahl' : undefined}
								>
									<Checkbox
										aria-label="{material.name} auswählen"
										checked={selectedIds.includes(material.id)}
										disabled={otherType}
										onCheckedChange={(checked) => select(material, checked)}
									/>
								</div>
							</Table.Cell>
						{/if}
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
							{#if variantCounts(material)}
								<p class="text-sm text-muted-foreground tabular-nums">
									<span class="sr-only">Verfügbar je Variante:</span>
									{variantCounts(material)}
								</p>
							{/if}
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
					{#if isOpen && material.trackingType === 'INDIVIDUAL'}
						<Table.Row class="hover:bg-transparent">
							<Table.Cell colspan={columns} class="bg-muted/30 p-3 whitespace-normal sm:pl-10">
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
						<Table.Cell colspan={columns} class="py-8 text-center text-muted-foreground">
							{query ? `Keine Materialien zu „${query}“ gefunden.` : 'Noch keine Materialien.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<MaterialDialog bind:this={materialDialog} locations={data.locations} items={data.items} />
<MergeDialog bind:this={mergeDialog} kits={data.kits} />
<ConfirmDelete bind:this={confirmDelete} />
