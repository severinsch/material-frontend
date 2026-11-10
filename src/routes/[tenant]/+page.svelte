<script lang="ts">
	import ArchiveIcon from '@lucide/svelte/icons/archive';
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import ClipboardListIcon from '@lucide/svelte/icons/clipboard-list';
	import MergeIcon from '@lucide/svelte/icons/merge';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import { SvelteSet } from 'svelte/reactivity';
	import type { IndividualItem, Material } from '#lib/api/index.js';
	import { materialActions } from '#lib/archive.js';
	import { trackingTypeLabels } from '#lib/format.js';
	import { isRetired } from '#lib/items.js';
	import { matchMaterial, normalizeSearch, type MaterialMatch } from '#lib/search.js';
	import { availableNow } from '#lib/settings.svelte.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import CategoryFilter from '#lib/components/CategoryFilter.svelte';
	import DeleteMaterialDialog from '#lib/components/DeleteMaterialDialog.svelte';
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
	let sort = $state<{ key: SortKey; descending: boolean }>({ key: 'category', descending: false });
	/** Materials whose items are shown, opened by hand. */
	const expanded = new SvelteSet<string>();
	/** Materials opened by the search (see [isOpen]) and closed by hand; forgotten when the search changes. */
	const collapsed = new SvelteSet<string>();
	let materialDialog: MaterialDialog;
	let mergeDialog: MergeDialog;
	let deleteDialog: DeleteMaterialDialog;
	/** Whether archived materials are listed too; they are hidden by default. */
	let showArchived = $state(false);
	/** The materials that can be listed: without archived ones, unless they are shown. */
	const listable = $derived(
		showArchived ? data.materials : data.materials.filter((material) => !material.archivedAt)
	);

	/** Whether materials are being selected to merge them; the first selected is the target. */
	let selecting = $state(false);
	let selectedIds = $state<string[]>([]);
	/** The selected materials in the order selected, without any deleted meanwhile. */
	const selected = $derived(
		selectedIds.flatMap((id) => data.materials.find((material) => material.id === id) ?? [])
	);
	/** Only materials of the same tracking type can be merged. */
	const selectableType = $derived(selected[0]?.trackingType);
	/** The selected categories ('' for none); all if empty. */
	const categories = new SvelteSet<string>();
	/** Categories with their number of materials, by name, "Ohne Kategorie" last. */
	const categoryCounts = $derived(
		[...Map.groupBy(listable, (material) => material.category ?? '')]
			.map(([category, inCategory]): [string, number] => [category, inCategory.length])
			.toSorted(([a], [b]) => categoryOrder(a, b))
	);
	/** Sorted by category, the materials are shown in sections per category; other columns sort them flat. */
	const grouped = $derived(sort.key === 'category');
	const columns = $derived(selecting ? 10 : 9);

	function categoryOrder(a: string, b: string) {
		return (a === '') !== (b === '') ? (a === '' ? 1 : -1) : a.localeCompare(b);
	}

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
		const names = (itemsByMaterial[material.id] ?? [])
			.filter((item) => !isRetired(item))
			.map((item) => item.storageLocation?.name);
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

	/** How each material matches the search, by id; item identifiers count too ("K07"). */
	const matches = $derived.by(() => {
		const search = normalizeSearch(query);
		return new Map<string, MaterialMatch>(
			data.materials.map((material) => [
				material.id,
				matchMaterial(
					search,
					[
						material.name,
						material.category,
						material.description,
						locationOf(material),
						...material.variants.map((variant) => variant.name)
					],
					itemsByMaterial[material.id] ?? []
				)
			])
		);
	});

	/** Whether [material] passes the category filter and the search. */
	function isFound(material: Material) {
		return (
			(categories.size === 0 || categories.has(material.category ?? '')) &&
			!!matches.get(material.id)?.matches
		);
	}

	const materials = $derived.by(() => {
		const value = sortValues[sort.key];
		const direction = sort.descending ? -1 : 1;
		return listable.filter(isFound).toSorted((a, b) => {
			const [x, y] = [value(a), value(b)];
			const order =
				typeof x === 'number' && typeof y === 'number'
					? x - y
					: String(x).localeCompare(String(y), undefined, { numeric: true });
			return order * direction || a.name.localeCompare(b.name);
		});
	});

	/** The listed materials by category, in their order within each. */
	const byCategory = $derived(
		[...Map.groupBy(materials, (material) => material.category ?? '')].toSorted(
			([a], [b]) => categoryOrder(a, b) * (sort.key === 'category' && sort.descending ? -1 : 1)
		)
	);

	/** Archived materials that would be listed if shown, which the toggle below the list points out. */
	const hiddenArchived = $derived(
		showArchived ? 0 : data.materials.filter((m) => m.archivedAt && isFound(m)).length
	);

	const emptyText = $derived(
		query || categories.size > 0
			? 'Keine passenden Materialien gefunden.'
			: hiddenArchived > 0
				? 'Alle Materialien sind archiviert.'
				: 'Noch keine Materialien.'
	);

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

	/** Whether [materialId] was found only by an item's identifier, so its items are shown to point it out. */
	function openedBySearch(materialId: string) {
		const match = matches.get(materialId);
		return !!match && !match.byText && match.itemIds.size > 0;
	}

	/** Whether the items of [materialId] are shown: opened by the search and not closed, or opened by hand. */
	function isOpen(materialId: string) {
		return openedBySearch(materialId) ? !collapsed.has(materialId) : expanded.has(materialId);
	}

	function toggle(materialId: string) {
		const toggled = openedBySearch(materialId) ? collapsed : expanded;
		if (!toggled.delete(materialId)) toggled.add(materialId);
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

{#snippet materialRows(material: Material)}
	{@const open = isOpen(material.id)}
	<Table.Row class={material.archivedAt ? 'text-muted-foreground' : undefined}>
		{#if selecting}
			{@const otherType = !!selectableType && material.trackingType !== selectableType}
			<Table.Cell class="pr-0">
				<div
					class="flex size-8 items-center justify-center"
					title={material.archivedAt
						? 'Archivierte Materialien lassen sich nicht zusammenführen'
						: otherType
							? 'Andere Erfassungsart als die Auswahl'
							: undefined}
				>
					<Checkbox
						aria-label="{material.name} auswählen"
						checked={selectedIds.includes(material.id)}
						disabled={otherType || !!material.archivedAt}
						onCheckedChange={(checked) => select(material, checked)}
					/>
				</div>
			</Table.Cell>
		{/if}
		<Table.Cell class="pr-0 max-sm:pl-0">
			{#if material.trackingType === 'INDIVIDUAL'}
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={open
						? `Gegenstände von ${material.name} ausblenden`
						: `Gegenstände von ${material.name} anzeigen`}
					aria-expanded={open}
					onclick={() => toggle(material.id)}
				>
					{#if open}<ChevronDownIcon />{:else}<ChevronRightIcon />{/if}
				</Button>
			{/if}
		</Table.Cell>
		<Table.Cell class="hyphens-auto whitespace-normal">
			<a href={tenant.href(`/materials/${material.id}`)} class="font-medium hover:underline"
				>{material.name}</a
			>
			{#if material.archivedAt}<Badge variant="secondary">Archiviert</Badge>{/if}
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
		<Table.Cell class="text-right tabular-nums">{availableNow(material)}</Table.Cell>
		<Table.Cell class="hidden md:table-cell">
			{#if material.category}<Badge variant="outline">{material.category}</Badge>{/if}
		</Table.Cell>
		<Table.Cell class="hidden whitespace-normal sm:table-cell">
			{locationOf(material) || '—'}
		</Table.Cell>
		<Table.Cell class="hidden text-muted-foreground lg:table-cell">
			{trackingTypeLabels[material.trackingType]}
		</Table.Cell>
		<Table.Cell class="hidden text-right tabular-nums sm:table-cell">
			{material.damagedCount}
		</Table.Cell>
		<Table.Cell class="hidden text-right tabular-nums sm:table-cell">
			{material.loanedCount}
		</Table.Cell>
		<!-- While selecting, phones leave out the row actions to make room for the checkboxes (T-18). -->
		<Table.Cell class={['text-right max-sm:pr-0', selecting && 'max-sm:hidden']}>
			{#if canEdit}
				<RowActions
					name={material.name}
					onedit={() => materialDialog.show(material)}
					actions={materialActions(api, material, {
						ondelete: () => deleteDialog.show(material)
					})}
				/>
			{/if}
		</Table.Cell>
	</Table.Row>
	{#if open && material.trackingType === 'INDIVIDUAL'}
		<Table.Row class="hover:bg-transparent">
			<Table.Cell colspan={columns} class="bg-muted/30 p-3 whitespace-normal sm:pl-10">
				<ItemTable
					{material}
					items={itemsByMaterial[material.id] ?? []}
					locations={data.locations}
					highlighted={matches.get(material.id)?.itemIds}
				/>
			</Table.Cell>
		</Table.Row>
	{/if}
{/snippet}

{#snippet empty()}
	<Table.Row>
		<Table.Cell colspan={columns} class="py-8 text-center text-muted-foreground">
			{emptyText}
		</Table.Cell>
	</Table.Row>
{/snippet}

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Materialien</h1>
		<div class="flex flex-wrap gap-2">
			<!-- For the Vorstand, the cash audit or insurance; quiet, since it's needed about once a year. -->
			<Button
				variant="ghost"
				href={tenant.href('/report')}
				aria-label="Inventarliste"
				title="Inventarliste zum Drucken"
			>
				<ClipboardListIcon /><span class="hidden sm:inline">Inventarliste</span>
			</Button>
			{#if canEdit}
				{#if !selecting}
					<Button variant="outline" onclick={() => (selecting = true)}>
						<MergeIcon />Zusammenführen
					</Button>
				{/if}
				<Button onclick={() => materialDialog.show()}><PlusIcon />Material anlegen</Button>
			{/if}
		</div>
	</div>

	{#if selecting}
		<!-- Sticks below the header, so "Weiter" stays at hand after selecting further down the list. The opaque
		     wrapper keeps the rows from showing through the tinted bar. -->
		<div class="sticky top-14 z-40 bg-background pt-2">
			<div
				class="flex flex-col gap-3 rounded-md border bg-muted/30 p-3 sm:flex-row sm:items-center"
				role="region"
				aria-label="Materialien zusammenführen"
			>
				<div class="flex-1 text-sm">
					{#if selected.length === 0}
						<p>
							Wähle die Materialien aus, die Varianten eines Materials werden sollen, z. B. Seil 10
							m, Seil 15 m und Seil 20 m.
						</p>
					{:else}
						<p aria-live="polite">
							<span class="font-medium">{selected.length} ausgewählt:</span>
							{selected.map((material) => material.name).join(', ')}
						</p>
						<p class="text-muted-foreground">
							Dazu passen nur Materialien, die {selectableType === 'BULK'
								? 'nach Menge'
								: 'einzeln'} erfasst werden.
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
		</div>
	{/if}

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
		<div class="relative flex-1">
			<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				aria-label="Materialien durchsuchen"
				placeholder="Name, Kennung, Kategorie, Lagerort…"
				class="pl-9"
				bind:value={query}
				oninput={() => collapsed.clear()}
			/>
		</div>
		<CategoryFilter counts={categoryCounts} selected={categories} />
		<LoanedToggle />
	</div>

	<!-- The table container scrolls horizontally, which would keep the sticky headings inside it. -->
	<div class="rounded-md border [&>[data-slot=table-container]]:overflow-visible">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					{#if selecting}
						<Table.Head class="w-8"><span class="sr-only">Auswahl</span></Table.Head>
					{/if}
					<Table.Head class="w-8"><span class="sr-only">Gegenstände</span></Table.Head>
					<Table.Head>{@render sortable('name', 'Name')}</Table.Head>
					<Table.Head class="text-right">{@render sortable('available', 'Verfügbar')}</Table.Head>
					<Table.Head class="hidden md:table-cell"
						>{@render sortable('category', 'Kategorie')}</Table.Head
					>
					<Table.Head class="hidden sm:table-cell"
						>{@render sortable('location', 'Lagerort')}</Table.Head
					>
					<Table.Head class="hidden lg:table-cell">Erfassung</Table.Head>
					<Table.Head class="hidden text-right sm:table-cell">
						{@render sortable('damaged', 'Beschädigt')}
					</Table.Head>
					<Table.Head class="hidden text-right sm:table-cell">
						{@render sortable('loaned', 'Ausgeliehen')}
					</Table.Head>
					<Table.Head class={['w-20', selecting && 'max-sm:hidden']}
						><span class="sr-only">Aktionen</span></Table.Head
					>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if grouped}
					{#each byCategory as [category, inCategory] (category)}
						<!-- Sticks below the app header, so the category stays in view while scrolling through it. -->
						<Table.Row class="hover:bg-transparent">
							<Table.Cell
								colspan={columns}
								class="sticky top-14 z-10 border-b bg-background/95 py-2 font-semibold backdrop-blur"
							>
								{category || 'Ohne Kategorie'}
								<span class="ml-1 font-normal text-muted-foreground tabular-nums"
									>{inCategory.length}</span
								>
							</Table.Cell>
						</Table.Row>
						{#each inCategory as material (material.id)}
							{@render materialRows(material)}
						{/each}
					{:else}
						{@render empty()}
					{/each}
				{:else}
					{#each materials as material (material.id)}
						{@render materialRows(material)}
					{:else}
						{@render empty()}
					{/each}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	{#if showArchived || hiddenArchived > 0}
		<!-- Archived materials stay out of the way: a quiet toggle below the list, which also points out search hits
		     among them. -->
		<Button
			variant="link"
			size="sm"
			class="h-auto p-0 text-muted-foreground pointer-coarse:min-h-11"
			onclick={() => (showArchived = !showArchived)}
		>
			<ArchiveIcon />
			{#if showArchived}
				Archivierte ausblenden
			{:else if query.trim() || categories.size > 0}
				{hiddenArchived}
				{hiddenArchived === 1 ? 'archiviertes passt' : 'archivierte passen'} auch – anzeigen
			{:else}
				{hiddenArchived} {hiddenArchived === 1 ? 'archiviertes' : 'archivierte'} anzeigen
			{/if}
		</Button>
	{/if}
</div>

<MaterialDialog bind:this={materialDialog} materials={data.materials} locations={data.locations} />
<MergeDialog bind:this={mergeDialog} />
<DeleteMaterialDialog bind:this={deleteDialog} />
