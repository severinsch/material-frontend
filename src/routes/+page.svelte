<script lang="ts">
	import { Input } from '$lib/components/ui/input';
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import { Label } from '$lib/components/ui/label';
	import * as Table from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
	import * as Alert from '$lib/components/ui/alert';
	import * as Dialog from '$lib/components/ui/dialog';
	import * as Select from '$lib/components/ui/select';
	import { Skeleton } from '$lib/components/ui/skeleton';
	import {
		Search,
		MoreHorizontal,
		ChevronDown,
		ChevronRight,
		Pencil,
		Trash2,
		Package,
		Plus,
		Loader2
	} from 'lucide-svelte';
	import type { Material, IndividualItem, NewBulkMaterial, NewIndividualMaterial, NewIndividualItem, StorageLocation } from '$lib/api';
	import { TrackingType, Condition } from '$lib/api';
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {apiClient} from "$lib/apiClient.ts";
	import {SvelteMap, SvelteSet} from "svelte/reactivity";

	let { data } = $props();

	// Search and filter state
	let searchQuery = $state('');
	let expandedRows = $state<Set<string>>(new Set());
	let itemsCache = $state<Map<string, IndividualItem[]>>(new Map());
	let loadingItems = $state<Set<string>>(new Set());

	// Storage locations state
	let locations = $state<StorageLocation[]>([]);
	let locationsLoaded = $state(false);

	async function loadLocations() {
		if (locationsLoaded) return;
		try {
			locations = await apiClient.locationsGet();
			locationsLoaded = true;
		} catch (error) {
			console.error('Failed to load locations:', error);
		}
	}

	// Delete dialog state
	let deleteDialogOpen = $state(false);
	let deleteTarget = $state<{ type: 'material' | 'item'; id: string; name: string; materialId?: string } | null>(null);
	let isDeleting = $state(false);

	// Edit material sheet state
	let editMaterialSheetOpen = $state(false);
	let editingMaterial = $state<Material | null>(null);
	let materialForm = $state<{
		name: string;
		category: string;
		description: string;
		availableCount: number;
		damagedCount: number;
	}>({
		name: '',
		category: '',
		description: '',
		availableCount: 0,
		damagedCount: 0
	});
	let isSavingMaterial = $state(false);

	// Edit item sheet state
	let editItemSheetOpen = $state(false);
	let editingItem = $state<IndividualItem | null>(null);
	let itemForm = $state<{
		identifier: string;
		condition: Condition;
		storageLocationId: string | null;
	}>({
		identifier: '',
		condition: Condition.Good,
		storageLocationId: null
	});
	let isSavingItem = $state(false);

	// Add material sheet state
	let addMaterialSheetOpen = $state(false);
	let addMaterialForm = $state<{
		name: string;
		category: string;
		description: string;
		trackingType: TrackingType;
		availableCount: number;
		damagedCount: number;
	}>({
		name: '',
		category: '',
		description: '',
		trackingType: TrackingType.Bulk,
		availableCount: 0,
		damagedCount: 0
	});
	let isSavingNewMaterial = $state(false);

	// Add item dialog state
	let addItemDialogOpen = $state(false);
	let addItemMaterialId = $state<string | null>(null);
	let addItemForm = $state<{
		identifier: string;
		condition: Condition;
		storageLocationId: string | null;
	}>({
		identifier: '',
		condition: Condition.Good,
		storageLocationId: null
	});
	let isSavingNewItem = $state(false);

	const trackingTypeOptions = [
		{ value: TrackingType.Bulk, label: 'Bulk', description: 'Track total quantity (e.g., rope, batteries)' },
		{ value: TrackingType.Individual, label: 'Individual', description: 'Track each item separately (e.g., tents, stoves)' }
	];

	const filteredMaterials = $derived(
		data.materials.filter((material) => {
			const query = searchQuery.toLowerCase();
			return (
				material.name.toLowerCase().includes(query) ||
				(material.category?.toLowerCase().includes(query) ?? false) ||
				(material.description?.toLowerCase().includes(query) ?? false)
			);
		})
	);

	const conditionOptions = [
		{ value: Condition.New, label: 'New' },
		{ value: Condition.Good, label: 'Good' },
		{ value: Condition.Fair, label: 'Fair' },
		{ value: Condition.Poor, label: 'Poor' },
		{ value: Condition.Decommissioned, label: 'Decommissioned' }
	];

	function toggleRow(materialId: string) {
		const newSet = new SvelteSet(expandedRows);
		if (newSet.has(materialId)) {
			newSet.delete(materialId);
		} else {
			newSet.add(materialId);
			if (!itemsCache.has(materialId)) {
				loadItems(materialId);
			}
		}
		expandedRows = newSet;
	}

	async function loadItems(materialId: string) {
		loadingItems = new Set([...loadingItems, materialId]);
		try {
			const items = await apiClient.materialsIdItemsGet({ id: materialId });
			itemsCache = new SvelteMap(itemsCache).set(materialId, items);
		} catch (error) {
			console.error('Failed to load items:', error);
		} finally {
			const newLoading = new SvelteSet(loadingItems);
			newLoading.delete(materialId);
			loadingItems = newLoading;
		}
	}

	function getConditionVariant(condition: Condition): 'default' | 'secondary' | 'destructive' | 'outline' {
		switch (condition) {
			case Condition.New:
				return 'default';
			case Condition.Good:
				return 'secondary';
			case Condition.Fair:
				return 'outline';
			case Condition.Poor:
			case Condition.Decommissioned:
				return 'destructive';
			default:
				return 'outline';
		}
	}

	function formatCondition(condition: Condition): string {
		return condition.charAt(0) + condition.slice(1).toLowerCase();
	}

	// Delete handlers
	function openDeleteDialog(type: 'material' | 'item', id: string, name: string, materialId?: string) {
		deleteTarget = { type, id, name, materialId };
		deleteDialogOpen = true;
	}

	async function confirmDelete() {
		if (!deleteTarget) return;

		isDeleting = true;
		try {
			if (deleteTarget.type === 'material') {
				await apiClient.materialsIdDelete({ id: deleteTarget.id });
				toast.success(`Material "${deleteTarget.name}" deleted successfully`);
				await invalidateAll();
			} else {
				await apiClient.itemsIdDelete({ id: deleteTarget.id });
				// Update items cache
				if (deleteTarget.materialId) {
					const currentItems = itemsCache.get(deleteTarget.materialId) ?? [];
					itemsCache = new SvelteMap(itemsCache).set(
						deleteTarget.materialId,
						currentItems.filter((item) => item.id !== deleteTarget!.id)
					);
				}
				toast.success(`Item "${deleteTarget.name}" deleted successfully`);
				await invalidateAll();
			}
			deleteDialogOpen = false;
			deleteTarget = null;
		} catch (error) {
			console.error('Failed to delete:', error);
			const message = error instanceof Error ? error.message : 'Unknown error occurred';
			toast.error(`Failed to delete: ${message}`);
		} finally {
			isDeleting = false;
		}
	}

	// Edit material handlers
	function openEditMaterial(material: Material) {
		editingMaterial = material;
		materialForm = {
			name: material.name,
			category: material.category ?? '',
			description: material.description ?? '',
			availableCount: material.availableCount,
			damagedCount: material.damagedCount
		};
		editMaterialSheetOpen = true;
	}

	async function saveMaterial() {
		if (!editingMaterial) return;

		isSavingMaterial = true;
		try {
			if (editingMaterial.trackingType === TrackingType.Bulk) {
				const payload: NewBulkMaterial = {
					name: materialForm.name,
					category: materialForm.category || undefined,
					description: materialForm.description || undefined,
					availableCount: materialForm.availableCount,
					damagedCount: materialForm.damagedCount
				};
				await apiClient.materialsBulkIdPut({ id: editingMaterial.id, newBulkMaterial: payload });
			} else {
				const payload: NewIndividualMaterial = {
					name: materialForm.name,
					category: materialForm.category || undefined,
					description: materialForm.description || undefined
				};
				await apiClient.materialsIndividualIdPut({ id: editingMaterial.id, newIndividualMaterial: payload });
			}
			toast.success(`Material "${materialForm.name}" updated successfully`);
			await invalidateAll();
			editMaterialSheetOpen = false;
			editingMaterial = null;
		} catch (error) {
			console.error('Failed to save material:', error);
			const message = error instanceof Error ? error.message : 'Unknown error occurred';
			toast.error(`Failed to save material: ${message}`);
		} finally {
			isSavingMaterial = false;
		}
	}

	// Edit item handlers
	function openEditItem(item: IndividualItem) {
		editingItem = item;
		itemForm = {
			identifier: item.identifier,
			condition: item.condition,
			storageLocationId: item.storageLocation?.id ?? null
		};
		loadLocations();
		editItemSheetOpen = true;
	}

	async function saveItem() {
		if (!editingItem) return;

		isSavingItem = true;
		try {
			const selectedLocation = itemForm.storageLocationId
				? locations.find((l) => l.id === itemForm.storageLocationId)
				: undefined;
			const payload: NewIndividualItem = {
				materialId: editingItem.materialId,
				identifier: itemForm.identifier,
				condition: itemForm.condition,
				storageLocation: selectedLocation ? { id: selectedLocation.id, name: selectedLocation.name } : undefined,
				purchasePrice: editingItem.purchasePrice,
				purchaseDate: editingItem.purchaseDate
			};
			const updatedItem = await apiClient.itemsIdPut({ id: editingItem.id, newIndividualItem: payload });

			// Update cache
			const currentItems = itemsCache.get(editingItem.materialId) ?? [];
			itemsCache = new SvelteMap(itemsCache).set(
				editingItem.materialId,
				currentItems.map((item) => (item.id === updatedItem.id ? updatedItem : item))
			);

			toast.success(`Item "${itemForm.identifier}" updated successfully`);
			await invalidateAll();
			editItemSheetOpen = false;
			editingItem = null;
		} catch (error) {
			console.error('Failed to save item:', error);
			const message = error instanceof Error ? error.message : 'Unknown error occurred';
			toast.error(`Failed to save item: ${message}`);
		} finally {
			isSavingItem = false;
		}
	}

	// Add material handlers
	function openAddMaterial() {
		addMaterialForm = {
			name: '',
			category: '',
			description: '',
			trackingType: TrackingType.Bulk,
			availableCount: 0,
			damagedCount: 0
		};
		addMaterialSheetOpen = true;
	}

	async function saveNewMaterial() {
		if (!addMaterialForm.name.trim()) {
			toast.error('Please enter a name for the material');
			return;
		}

		isSavingNewMaterial = true;
		try {
			if (addMaterialForm.trackingType === TrackingType.Bulk) {
				const payload: NewBulkMaterial = {
					name: addMaterialForm.name,
					category: addMaterialForm.category || undefined,
					description: addMaterialForm.description || undefined,
					availableCount: addMaterialForm.availableCount,
					damagedCount: addMaterialForm.damagedCount
				};
				await apiClient.materialsBulkPost({ newBulkMaterial: payload });
			} else {
				const payload: NewIndividualMaterial = {
					name: addMaterialForm.name,
					category: addMaterialForm.category || undefined,
					description: addMaterialForm.description || undefined
				};
				await apiClient.materialsIndividualPost({ newIndividualMaterial: payload });
			}
			toast.success(`Material "${addMaterialForm.name}" created successfully`);
			await invalidateAll();
			addMaterialSheetOpen = false;
		} catch (error) {
			console.error('Failed to create material:', error);
			const message = error instanceof Error ? error.message : 'Unknown error occurred';
			toast.error(`Failed to create material: ${message}`);
		} finally {
			isSavingNewMaterial = false;
		}
	}

	// Add item handlers
	function openAddItem(materialId: string) {
		addItemMaterialId = materialId;
		addItemForm = {
			identifier: '',
			condition: Condition.Good,
			storageLocationId: null
		};
		loadLocations();
		addItemDialogOpen = true;
	}

	async function saveNewItem() {
		if (!addItemMaterialId) return;

		if (!addItemForm.identifier.trim()) {
			toast.error('Please enter an identifier for the item');
			return;
		}

		isSavingNewItem = true;
		try {
			const selectedLocation = addItemForm.storageLocationId
				? locations.find((l) => l.id === addItemForm.storageLocationId)
				: undefined;
			const payload: NewIndividualItem = {
				materialId: addItemMaterialId,
				identifier: addItemForm.identifier,
				condition: addItemForm.condition,
				storageLocation: selectedLocation ? { id: selectedLocation.id, name: selectedLocation.name } : undefined
			};
			const newItem = await apiClient.itemsPost({ newIndividualItem: payload });

			// Update cache
			const currentItems = itemsCache.get(addItemMaterialId) ?? [];
			itemsCache = new SvelteMap(itemsCache).set(addItemMaterialId, [...currentItems, newItem]);

			toast.success(`Item "${addItemForm.identifier}" created successfully`);
			await invalidateAll();
			addItemDialogOpen = false;
			addItemMaterialId = null;
		} catch (error) {
			console.error('Failed to create item:', error);
			const message = error instanceof Error ? error.message : 'Unknown error occurred';
			toast.error(`Failed to create item: ${message}`);
		} finally {
			isSavingNewItem = false;
		}
	}
</script>

<div class="space-y-4">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Materials</h1>
			<p class="text-muted-foreground">Manage your scout group's equipment inventory</p>
		</div>
		<Button onclick={openAddMaterial}>
			<Plus class="mr-2 h-4 w-4" />
			Add Material
		</Button>
	</div>

	<div class="relative">
		<Search class="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
		<Input
			type="search"
			placeholder="Search materials..."
			class="pl-10"
			bind:value={searchQuery}
		/>
	</div>

	{#if filteredMaterials.length === 0}
		<Alert.Root>
			<Package class="h-4 w-4" />
			<Alert.Title>No materials found</Alert.Title>
			<Alert.Description>
				{#if searchQuery}
					No materials match your search "{searchQuery}". Try a different search term.
				{:else}
					You haven't added any materials yet. Click "Add Material" to get started.
				{/if}
			</Alert.Description>
		</Alert.Root>
	{:else}
		<!-- Desktop Table View -->
		<div class="hidden md:block">
			<div class="rounded-md border">
				<Table.Root>
					<Table.Header>
						<Table.Row>
							<Table.Head class="w-10"></Table.Head>
							<Table.Head>Name</Table.Head>
							<Table.Head>Category</Table.Head>
							<Table.Head class="text-center">Available</Table.Head>
							<Table.Head class="text-center">Damaged</Table.Head>
							<Table.Head class="text-right">Actions</Table.Head>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{#each filteredMaterials as material (material.id)}
							{@const isExpanded = expandedRows.has(material.id)}
							{@const isIndividual = material.trackingType === TrackingType.Individual}
							<Table.Row class="group">
								<Table.Cell>
									{#if isIndividual}
										<Button
											variant="ghost"
											size="icon-sm"
											onclick={() => toggleRow(material.id)}
										>
											{#if isExpanded}
												<ChevronDown class="h-4 w-4" />
											{:else}
												<ChevronRight class="h-4 w-4" />
											{/if}
										</Button>
									{/if}
								</Table.Cell>
								<Table.Cell class="font-medium">
									<div class="flex flex-col">
										<span>{material.name}</span>
										{#if material.description}
											<span class="text-muted-foreground text-sm">{material.description}</span>
										{/if}
									</div>
								</Table.Cell>
								<Table.Cell>
									{#if material.category}
										<Badge variant="outline">{material.category}</Badge>
									{:else}
										<span class="text-muted-foreground">—</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-center">
									<Badge variant="secondary">{material.availableCount}</Badge>
								</Table.Cell>
								<Table.Cell class="text-center">
									{#if material.damagedCount > 0}
										<Badge variant="secondary">{material.damagedCount}</Badge>
									{:else}
										<span class="text-muted-foreground">0</span>
									{/if}
								</Table.Cell>
								<Table.Cell class="text-right">
									<DropdownMenu.Root>
										<DropdownMenu.Trigger>
											{#snippet child({ props })}
												<Button variant="ghost" size="icon-sm" {...props}>
													<MoreHorizontal class="h-4 w-4" />
													<span class="sr-only">Open menu</span>
												</Button>
											{/snippet}
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="end">
											<DropdownMenu.Item onclick={() => openEditMaterial(material)}>
												<Pencil class="mr-2 h-4 w-4" />
												Edit
											</DropdownMenu.Item>
											<DropdownMenu.Separator />
											<DropdownMenu.Item
												class="text-destructive"
												onclick={() => openDeleteDialog('material', material.id, material.name)}
											>
												<Trash2 class="mr-2 h-4 w-4" />
												Delete
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
								</Table.Cell>
							</Table.Row>
							{#if isIndividual && isExpanded}
								<Table.Row>
									<Table.Cell colspan={6} class="bg-muted/30 p-0">
										<div class="py-4 pr-4 pl-14 ml-4 border-l-2 border-muted-foreground/20">
											{#if loadingItems.has(material.id)}
												<div class="space-y-2">
													{#each Array(3) as _}
														<Skeleton class="h-10 w-full" />
													{/each}
												</div>
											{:else if itemsCache.get(material.id)?.length === 0}
												<p class="text-muted-foreground text-sm">No individual items found.</p>
											{:else}
												<Table.Root>
													<Table.Header>
														<Table.Row>
															<Table.Head>Identifier</Table.Head>
															<Table.Head>Condition</Table.Head>
															<Table.Head>Location</Table.Head>
															<Table.Head>Purchase Date</Table.Head>
															<Table.Head class="text-right">Actions</Table.Head>
														</Table.Row>
													</Table.Header>
													<Table.Body>
														{#each itemsCache.get(material.id) ?? [] as item (item.id)}
															<Table.Row>
																<Table.Cell class="font-medium">{item.identifier}</Table.Cell>
																<Table.Cell>
																	<Badge variant={getConditionVariant(item.condition)}>
																		{formatCondition(item.condition)}
																	</Badge>
																</Table.Cell>
																<Table.Cell>
																	{item.storageLocation?.name ?? '—'}
																</Table.Cell>
																<Table.Cell>
																	{item.purchaseDate ?? '—'}
																</Table.Cell>
																<Table.Cell class="text-right">
																	<DropdownMenu.Root>
																		<DropdownMenu.Trigger>
																			{#snippet child({ props })}
																				<Button variant="ghost" size="icon-sm" {...props}>
																					<MoreHorizontal class="h-4 w-4" />
																					<span class="sr-only">Open menu</span>
																				</Button>
																			{/snippet}
																		</DropdownMenu.Trigger>
																		<DropdownMenu.Content align="end">
																			<DropdownMenu.Item onclick={() => openEditItem(item)}>
																				<Pencil class="mr-2 h-4 w-4" />
																				Edit
																			</DropdownMenu.Item>
																			<DropdownMenu.Separator />
																			<DropdownMenu.Item
																				class="text-destructive"
																				onclick={() => openDeleteDialog('item', item.id, item.identifier, material.id)}
																			>
																				<Trash2 class="mr-2 h-4 w-4" />
																				Delete
																			</DropdownMenu.Item>
																		</DropdownMenu.Content>
																	</DropdownMenu.Root>
																</Table.Cell>
															</Table.Row>
														{/each}
													</Table.Body>
												</Table.Root>
											{/if}
											<div class="mt-3">
												<Button variant="outline" size="sm" onclick={() => openAddItem(material.id)}>
													<Plus class="mr-2 h-4 w-4" />
													Add Item
												</Button>
											</div>
										</div>
									</Table.Cell>
								</Table.Row>
							{/if}
						{/each}
					</Table.Body>
				</Table.Root>
			</div>
		</div>

		<!-- Mobile Card View -->
		<div class="grid gap-4 md:hidden">
			{#each filteredMaterials as material (material.id)}
				{@const isExpanded = expandedRows.has(material.id)}
				{@const isIndividual = material.trackingType === TrackingType.Individual}
				<Card.Root>
					<Card.Header class="pb-2">
						<div class="flex items-start justify-between">
							<div class="space-y-1">
								<Card.Title class="text-base">{material.name}</Card.Title>
								{#if material.category}
									<Badge variant="outline" class="text-xs">{material.category}</Badge>
								{/if}
							</div>
							<DropdownMenu.Root>
								<DropdownMenu.Trigger>
									{#snippet child({ props })}
										<Button variant="ghost" size="icon-sm" {...props}>
											<MoreHorizontal class="h-4 w-4" />
										</Button>
									{/snippet}
								</DropdownMenu.Trigger>
								<DropdownMenu.Content align="end">
									<DropdownMenu.Item onclick={() => openEditMaterial(material)}>
										<Pencil class="mr-2 h-4 w-4" />
										Edit
									</DropdownMenu.Item>
									<DropdownMenu.Separator />
									<DropdownMenu.Item
										class="text-destructive"
										onclick={() => openDeleteDialog('material', material.id, material.name)}
									>
										<Trash2 class="mr-2 h-4 w-4" />
										Delete
									</DropdownMenu.Item>
								</DropdownMenu.Content>
							</DropdownMenu.Root>
						</div>
					</Card.Header>
					<Card.Content class="pb-2">
						{#if material.description}
							<p class="text-muted-foreground mb-3 text-sm">{material.description}</p>
						{/if}
						<div class="flex gap-4">
							<div class="text-sm">
								<span class="text-muted-foreground">Available:</span>
								<Badge variant="secondary" class="ml-1">{material.availableCount}</Badge>
							</div>
							<div class="text-sm">
								<span class="text-muted-foreground">Damaged:</span>
								{#if material.damagedCount > 0}
									<Badge variant="secondary" class="ml-1">{material.damagedCount}</Badge>
								{:else}
									<span class="text-muted-foreground ml-1">0</span>
								{/if}
							</div>
						</div>
					</Card.Content>
					{#if isIndividual}
						<Card.Footer class="flex-col items-stretch gap-2 pt-2">
							<Button
								variant="ghost"
								class="w-full justify-between"
								onclick={() => toggleRow(material.id)}
							>
								<span>View Items</span>
								{#if isExpanded}
									<ChevronDown class="h-4 w-4" />
								{:else}
									<ChevronRight class="h-4 w-4" />
								{/if}
							</Button>
							{#if isExpanded}
								<div class="border-t pt-2">
									{#if loadingItems.has(material.id)}
										<div class="space-y-2">
											{#each Array(2) as _}
												<Skeleton class="h-16 w-full" />
											{/each}
										</div>
									{:else if itemsCache.get(material.id)?.length === 0}
										<p class="text-muted-foreground py-2 text-center text-sm">
											No individual items found.
										</p>
									{:else}
										<div class="space-y-2">
											{#each itemsCache.get(material.id) ?? [] as item (item.id)}
												<div class="bg-muted/50 rounded-md p-3">
													<div class="flex items-center justify-between">
														<span class="font-medium">{item.identifier}</span>
														<div class="flex items-center gap-2">
															<Badge variant={getConditionVariant(item.condition)}>
																{formatCondition(item.condition)}
															</Badge>
															<DropdownMenu.Root>
																<DropdownMenu.Trigger>
																	{#snippet child({ props })}
																		<Button variant="ghost" size="icon-sm" {...props}>
																			<MoreHorizontal class="h-4 w-4" />
																		</Button>
																	{/snippet}
																</DropdownMenu.Trigger>
																<DropdownMenu.Content align="end">
																	<DropdownMenu.Item onclick={() => openEditItem(item)}>
																		<Pencil class="mr-2 h-4 w-4" />
																		Edit
																	</DropdownMenu.Item>
																	<DropdownMenu.Separator />
																	<DropdownMenu.Item
																		class="text-destructive"
																		onclick={() => openDeleteDialog('item', item.id, item.identifier, material.id)}
																	>
																		<Trash2 class="mr-2 h-4 w-4" />
																		Delete
																	</DropdownMenu.Item>
																</DropdownMenu.Content>
															</DropdownMenu.Root>
														</div>
													</div>
													{#if item.storageLocation?.name}
														<p class="text-muted-foreground mt-1 text-sm">
															{item.storageLocation.name}
														</p>
													{/if}
												</div>
											{/each}
										</div>
									{/if}
									<div class="mt-3">
										<Button variant="outline" size="sm" class="w-full" onclick={() => openAddItem(material.id)}>
											<Plus class="mr-2 h-4 w-4" />
											Add Item
										</Button>
									</div>
								</div>
							{/if}
						</Card.Footer>
					{/if}
				</Card.Root>
			{/each}
		</div>
	{/if}
</div>

<!-- Delete Confirmation Dialog -->
<Dialog.Root bind:open={deleteDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Delete {deleteTarget?.type === 'material' ? 'Material' : 'Item'}</Dialog.Title>
			<Dialog.Description>
				Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (deleteDialogOpen = false)} disabled={isDeleting}>
				Cancel
			</Button>
			<Button variant="destructive" onclick={confirmDelete} disabled={isDeleting}>
				{#if isDeleting}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Delete
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Material Dialog -->
<Dialog.Root bind:open={editMaterialSheetOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Material</Dialog.Title>
			<Dialog.Description>
				Update the details for {editingMaterial?.name}
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="material-name">Name</Label>
				<Input id="material-name" bind:value={materialForm.name} />
			</div>
			<div class="grid gap-2">
				<Label for="material-category">Category</Label>
				<Input id="material-category" bind:value={materialForm.category} />
			</div>
			<div class="grid gap-2">
				<Label for="material-description">Description</Label>
				<Input id="material-description" bind:value={materialForm.description} />
			</div>
			{#if editingMaterial?.trackingType === TrackingType.Bulk}
				<div class="grid grid-cols-2 gap-4">
					<div class="grid gap-2">
						<Label for="material-available">Available Count</Label>
						<Input
							id="material-available"
							type="number"
							min="0"
							bind:value={materialForm.availableCount}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="material-damaged">Damaged Count</Label>
						<Input
							id="material-damaged"
							type="number"
							min="0"
							bind:value={materialForm.damagedCount}
						/>
					</div>
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (editMaterialSheetOpen = false)} disabled={isSavingMaterial}>
				Cancel
			</Button>
			<Button onclick={saveMaterial} disabled={isSavingMaterial}>
				{#if isSavingMaterial}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Save Changes
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Edit Item Dialog -->
<Dialog.Root bind:open={editItemSheetOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Edit Item</Dialog.Title>
			<Dialog.Description>
				Update the details for {editingItem?.identifier}
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="item-identifier">Identifier</Label>
				<Input id="item-identifier" bind:value={itemForm.identifier} />
			</div>
			<div class="grid gap-2">
				<Label for="item-condition">Condition</Label>
				<Select.Root
					type="single"
					value={itemForm.condition}
					onValueChange={(value) => {
						if (value) itemForm.condition = value as Condition;
					}}
				>
					<Select.Trigger id="item-condition">
						{conditionOptions.find((c) => c.value === itemForm.condition)?.label ?? 'Select condition'}
					</Select.Trigger>
					<Select.Content>
						{#each conditionOptions as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="grid gap-2">
				<Label for="item-location">Storage Location</Label>
				<Select.Root
					type="single"
					value={itemForm.storageLocationId ?? undefined}
					onValueChange={(value) => {
						itemForm.storageLocationId = value ?? null;
					}}
				>
					<Select.Trigger id="item-location">
						{locations.find((l) => l.id === itemForm.storageLocationId)?.name ?? 'Select location'}
					</Select.Trigger>
					<Select.Content>
						{#each locations as location}
							<Select.Item value={location.id}>{location.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (editItemSheetOpen = false)} disabled={isSavingItem}>
				Cancel
			</Button>
			<Button onclick={saveItem} disabled={isSavingItem}>
				{#if isSavingItem}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Save Changes
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Add Material Dialog -->
<Dialog.Root bind:open={addMaterialSheetOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Material</Dialog.Title>
			<Dialog.Description>
				Create a new material in your inventory
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="add-material-name">Name *</Label>
				<Input id="add-material-name" bind:value={addMaterialForm.name} placeholder="e.g., Tent, Rope, First Aid Kit" />
			</div>
			<div class="grid gap-2">
				<Label for="add-material-type">Tracking Type</Label>
				<Select.Root
					type="single"
					value={addMaterialForm.trackingType}
					onValueChange={(value) => {
						if (value) addMaterialForm.trackingType = value as TrackingType;
					}}
				>
					<Select.Trigger id="add-material-type">
						{trackingTypeOptions.find((t) => t.value === addMaterialForm.trackingType)?.label ?? 'Select type'}
					</Select.Trigger>
					<Select.Content>
						{#each trackingTypeOptions as option}
							<Select.Item value={option.value}>
								<div class="flex flex-col">
									<span>{option.label}</span>
									<span class="text-muted-foreground text-xs">{option.description}</span>
								</div>
							</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="grid gap-2">
				<Label for="add-material-category">Category</Label>
				<Input id="add-material-category" bind:value={addMaterialForm.category} placeholder="e.g., Camping, Safety, Tools" />
			</div>
			<div class="grid gap-2">
				<Label for="add-material-description">Description</Label>
				<Input id="add-material-description" bind:value={addMaterialForm.description} placeholder="Optional description" />
			</div>
			{#if addMaterialForm.trackingType === TrackingType.Bulk}
				<div class="grid grid-cols-2 gap-4">
					<div class="grid gap-2">
						<Label for="add-material-available">Available Count</Label>
						<Input
							id="add-material-available"
							type="number"
							min="0"
							bind:value={addMaterialForm.availableCount}
						/>
					</div>
					<div class="grid gap-2">
						<Label for="add-material-damaged">Damaged Count</Label>
						<Input
							id="add-material-damaged"
							type="number"
							min="0"
							bind:value={addMaterialForm.damagedCount}
						/>
					</div>
				</div>
			{/if}
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (addMaterialSheetOpen = false)} disabled={isSavingNewMaterial}>
				Cancel
			</Button>
			<Button onclick={saveNewMaterial} disabled={isSavingNewMaterial}>
				{#if isSavingNewMaterial}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Create Material
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>

<!-- Add Item Dialog -->
<Dialog.Root bind:open={addItemDialogOpen}>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Add Item</Dialog.Title>
			<Dialog.Description>
				Add a new individual item to this material
			</Dialog.Description>
		</Dialog.Header>
		<div class="grid gap-4 py-4">
			<div class="grid gap-2">
				<Label for="add-item-identifier">Identifier *</Label>
				<Input id="add-item-identifier" bind:value={addItemForm.identifier} placeholder="e.g., TENT-001, STOVE-A" />
			</div>
			<div class="grid gap-2">
				<Label for="add-item-condition">Condition</Label>
				<Select.Root
					type="single"
					value={addItemForm.condition}
					onValueChange={(value) => {
						if (value) addItemForm.condition = value as Condition;
					}}
				>
					<Select.Trigger id="add-item-condition">
						{conditionOptions.find((c) => c.value === addItemForm.condition)?.label ?? 'Select condition'}
					</Select.Trigger>
					<Select.Content>
						{#each conditionOptions as option}
							<Select.Item value={option.value}>{option.label}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div class="grid gap-2">
				<Label for="add-item-location">Storage Location</Label>
				<Select.Root
					type="single"
					value={addItemForm.storageLocationId ?? undefined}
					onValueChange={(value) => {
						addItemForm.storageLocationId = value ?? null;
					}}
				>
					<Select.Trigger id="add-item-location">
						{locations.find((l) => l.id === addItemForm.storageLocationId)?.name ?? 'Select location'}
					</Select.Trigger>
					<Select.Content>
						{#each locations as location}
							<Select.Item value={location.id}>{location.name}</Select.Item>
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
		</div>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (addItemDialogOpen = false)} disabled={isSavingNewItem}>
				Cancel
			</Button>
			<Button onclick={saveNewItem} disabled={isSavingNewItem}>
				{#if isSavingNewItem}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Add Item
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
