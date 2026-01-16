<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Badge } from '$lib/components/ui/badge';
	import * as Card from '$lib/components/ui/card';
	import * as Alert from '$lib/components/ui/alert';
	import {
		Plus,
		Minus,
		Boxes,
		Package,
		ShoppingCart,
		Trash2,
		AlertTriangle,
		ChevronRight,
		Copy,
		Check
	} from 'lucide-svelte';
	import type { KitSubstitutionGroupsInner } from '$lib/api';
	import { SvelteMap } from 'svelte/reactivity';

	let { data } = $props();

	// Packing list: Map of kit ID to quantity
	let packingList = $state<Map<string, number>>(new SvelteMap());

	// Create a lookup map for materials by ID
	const materialLookup = $derived(
		new Map(data.materials.map((m) => [m.id, m]))
	);

	// Create a lookup map for kits by ID
	const kitLookup = $derived(
		new Map(data.kits.map((k) => [k.id, k]))
	);

	// Get available count for a material
	function getAvailableCount(materialId: string): number {
		return materialLookup.get(materialId)?.availableCount ?? 0;
	}

	// Get material name by ID
	function getMaterialName(materialId: string): string {
		return materialLookup.get(materialId)?.name ?? 'Unknown Material';
	}

	// Get kit name by ID
	function getKitName(kitId: string): string {
		return kitLookup.get(kitId)?.name ?? 'Unknown Kit';
	}

	// Add kit to packing list
	function addKit(kitId: string) {
		const current = packingList.get(kitId) ?? 0;
		packingList = new SvelteMap(packingList).set(kitId, current + 1);
	}

	// Remove one kit from packing list
	function removeKit(kitId: string) {
		const current = packingList.get(kitId) ?? 0;
		if (current <= 1) {
			const newMap = new SvelteMap(packingList);
			newMap.delete(kitId);
			packingList = newMap;
		} else {
			packingList = new SvelteMap(packingList).set(kitId, current - 1);
		}
	}

	// Remove kit entirely from packing list
	function removeKitEntirely(kitId: string) {
		const newMap = new SvelteMap(packingList);
		newMap.delete(kitId);
		packingList = newMap;
	}

	// Clear entire packing list
	function clearPackingList() {
		packingList = new SvelteMap();
	}

	// Type for combined material entry with breakdown by kit
	interface CombinedMaterial {
		materialId: string;
		name: string;
		totalRequired: number;
		available: number;
		isShort: boolean;
		breakdown: { kitId: string; kitName: string; quantity: number }[];
	}

	// Calculate combined materials for the packing list
	interface CalculatedMaterials {
		materials: CombinedMaterial[];
		hasShortages: boolean;
	}

	// Calculate optimal material allocation for a substitution group
	function allocateSubstitutionGroup(
		group: KitSubstitutionGroupsInner,
		kitQuantity: number,
		kitId: string,
		availableMaterials: Map<string, number>,
		materialsByKit: Map<string, Map<string, number>> // materialId -> kitId -> quantity
	): { allocatedUnits: number; minRequiredUnits: number } {
		const requiredUnits = group.requiredUnits * kitQuantity;
		const minRequiredUnits = group.minRequiredUnits * kitQuantity;
		let remainingUnits = requiredUnits;

		// Sort options: preferred first, then by unit value (higher first for efficiency)
		const sortedOptions = [...group.options].sort((a, b) => {
			if (a.isPreferred !== b.isPreferred) return a.isPreferred ? -1 : 1;
			return b.unitValue - a.unitValue;
		});

		// Find the preferred option (first in sorted list)
		const preferredOption = sortedOptions[0];

		for (const option of sortedOptions) {
			if (remainingUnits <= 0) break;

			const available = availableMaterials.get(option.materialId) ?? 0;
			if (available <= 0) continue;

			// Calculate how many of this material we need
			const unitsNeeded = remainingUnits;
			const itemsNeeded = Math.ceil(unitsNeeded / option.unitValue);
			const itemsToUse = Math.min(itemsNeeded, available);
			const unitsProvided = itemsToUse * option.unitValue;

			if (itemsToUse > 0) {
				// Track material usage by kit
				if (!materialsByKit.has(option.materialId)) {
					materialsByKit.set(option.materialId, new Map());
				}
				const kitBreakdown = materialsByKit.get(option.materialId)!;
				kitBreakdown.set(kitId, (kitBreakdown.get(kitId) ?? 0) + itemsToUse);

				availableMaterials.set(option.materialId, available - itemsToUse);
				remainingUnits -= unitsProvided;
			}
		}

		// If we still have remaining units (shortage), add them to the preferred material
		// This makes the shortage visible in the materials list
		if (remainingUnits > 0 && preferredOption) {
			const itemsNeeded = Math.ceil(remainingUnits / preferredOption.unitValue);
			if (!materialsByKit.has(preferredOption.materialId)) {
				materialsByKit.set(preferredOption.materialId, new Map());
			}
			const kitBreakdown = materialsByKit.get(preferredOption.materialId)!;
			kitBreakdown.set(kitId, (kitBreakdown.get(kitId) ?? 0) + itemsNeeded);
		}

		const allocatedUnits = requiredUnits - Math.max(0, remainingUnits);
		return { allocatedUnits, minRequiredUnits };
	}

	const calculatedMaterials = $derived((): CalculatedMaterials => {
		// Track materials by kit: materialId -> kitId -> quantity
		const materialsByKit = new SvelteMap<string, Map<string, number>>();
		let hasShortages = false;

		// Create a mutable copy of available materials
		const availableMaterials = new SvelteMap<string, number>();
		for (const material of data.materials) {
			availableMaterials.set(material.id, material.availableCount);
		}

		// First, calculate fixed materials (these are always allocated first)
		for (const [kitId, quantity] of packingList.entries()) {
			const kit = data.kits.find((k) => k.id === kitId);
			if (!kit) continue;

			for (const fixed of kit.fixedMaterials) {
				if (!materialsByKit.has(fixed.materialId)) {
					materialsByKit.set(fixed.materialId, new Map());
				}
				const kitBreakdown = materialsByKit.get(fixed.materialId)!;
				kitBreakdown.set(kitId, (kitBreakdown.get(kitId) ?? 0) + fixed.quantity * quantity);
			}
		}

		// Deduct fixed materials from available pool
		for (const [materialId, kitMap] of materialsByKit.entries()) {
			const totalRequired = Array.from(kitMap.values()).reduce((sum, q) => sum + q, 0);
			const available = availableMaterials.get(materialId) ?? 0;
			availableMaterials.set(materialId, Math.max(0, available - totalRequired));
			if (totalRequired > getAvailableCount(materialId)) {
				hasShortages = true;
			}
		}

		// Then, allocate substitution groups
		for (const [kitId, quantity] of packingList.entries()) {
			const kit = data.kits.find((k) => k.id === kitId);
			if (!kit) continue;

			for (const group of kit.substitutionGroups) {
				const result = allocateSubstitutionGroup(group, quantity, kitId, availableMaterials, materialsByKit);
				if (result.allocatedUnits < result.minRequiredUnits) {
					hasShortages = true;
				}
			}
		}

		// Convert to combined materials array
		const materials: CombinedMaterial[] = Array.from(materialsByKit.entries()).map(([materialId, kitMap]) => {
			const breakdown = Array.from(kitMap.entries()).map(([kitId, quantity]) => ({
				kitId,
				kitName: getKitName(kitId),
				quantity
			}));
			const totalRequired = breakdown.reduce((sum, b) => sum + b.quantity, 0);
			const available = getAvailableCount(materialId);

			return {
				materialId,
				name: getMaterialName(materialId),
				totalRequired,
				available,
				isShort: totalRequired > available,
				breakdown
			};
		});

		// Sort by name
		materials.sort((a, b) => a.name.localeCompare(b.name));

		return { materials, hasShortages };
	});

	// Total kits in packing list
	const totalKitsCount = $derived(
		Array.from(packingList.values()).reduce((sum, qty) => sum + qty, 0)
	);

	// Calculate how many items are needed to complete the required units
	function getItemsNeeded(requiredUnits: number, unitValue: number): number {
		return Math.ceil(requiredUnits / unitValue);
	}

	// Copy feedback state
	let copiedToClipboard = $state(false);

	// Copy materials list to clipboard
	async function copyMaterialsList() {
		const materials = calculatedMaterials().materials;
		const text = materials.map(m => `${m.totalRequired}x ${m.name}`).join('\n');
		await navigator.clipboard.writeText(text);
		copiedToClipboard = true;
		setTimeout(() => {
			copiedToClipboard = false;
		}, 2000);
	}
</script>

<div class="space-y-4">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Kits</h1>
			<p class="text-muted-foreground">Browse and select kits for your packing list</p>
		</div>
	</div>

	{#if data.kits.length === 0}
		<Alert.Root>
			<Boxes class="h-4 w-4" />
			<Alert.Title>No kits found</Alert.Title>
			<Alert.Description>
				There are no kits configured yet.
			</Alert.Description>
		</Alert.Root>
	{:else}
		<div class="grid gap-6 lg:grid-cols-3">
			<!-- Kits List -->
			<div class="lg:col-span-2 space-y-4">
				<h2 class="text-lg font-semibold">Available Kits</h2>
				<div class="grid gap-4 sm:grid-cols-2">
					{#each data.kits as kit (kit.id)}
						{@const quantityInList = packingList.get(kit.id) ?? 0}
						<Card.Root>
							<Card.Header class="pb-2">
								<div class="flex items-start justify-between">
									<div>
										<Card.Title class="text-base">{kit.name}</Card.Title>
										{#if kit.description}
											<Card.Description class="text-sm">{kit.description}</Card.Description>
										{/if}
									</div>
									{#if quantityInList > 0}
										<Badge variant="secondary">{quantityInList} selected</Badge>
									{/if}
								</div>
							</Card.Header>
							<Card.Content class="pb-2">
								<ul class="text-sm space-y-2">
									<!-- Fixed Materials -->
									{#each kit.fixedMaterials as fixed}
										{@const available = getAvailableCount(fixed.materialId)}
										{@const isShort = fixed.quantity > available}
										<li class="flex items-center justify-between">
											<span class="flex items-center gap-1 {isShort ? 'text-destructive' : ''}">
												<span class="text-muted-foreground {isShort ? 'text-destructive' : ''}">{fixed.quantity}x</span>
												{getMaterialName(fixed.materialId)}
											</span>
											<span class="text-muted-foreground text-xs {isShort ? 'text-destructive' : ''}">
												{available} avail.
											</span>
										</li>
									{/each}

									<!-- Substitution Groups (as regular items) -->
									{#each kit.substitutionGroups as group}
										<li>
											<div class="flex items-center justify-between">
												<span class="flex items-center gap-2">
													{group.name}
													{#if group.isOptional}
														<Badge variant="outline" class="text-xs">Optional</Badge>
													{/if}
												</span>
												<span class="text-muted-foreground text-xs">
													{group.requiredUnits} units
												</span>
											</div>
											<ul class="mt-1 ml-3 space-y-0.5 border-l border-muted pl-2">
												{#each group.options as option}
													{@const available = getAvailableCount(option.materialId)}
													{@const itemsNeeded = getItemsNeeded(group.requiredUnits, option.unitValue)}
													<li class="flex items-center justify-between text-xs">
														<span class="flex items-center gap-1">
															{#if option.isPreferred}
																<ChevronRight class="h-3 w-3 text-primary" />
															{:else}
																<span class="w-3"></span>
															{/if}
															<span class="text-muted-foreground">{itemsNeeded}x</span>
															{getMaterialName(option.materialId)}
														</span>
														<span class="text-muted-foreground">{available} avail.</span>
													</li>
												{/each}
											</ul>
										</li>
									{/each}
								</ul>
							</Card.Content>
							<Card.Footer class="pt-2">
								<div class="flex items-center gap-2 w-full">
									{#if quantityInList > 0}
										<Button variant="outline" size="icon-sm" onclick={() => removeKit(kit.id)}>
											<Minus class="h-4 w-4" />
										</Button>
										<span class="w-8 text-center font-medium">{quantityInList}</span>
									{/if}
									<Button
										variant={quantityInList > 0 ? 'outline' : 'default'}
										size={quantityInList > 0 ? 'icon-sm' : 'sm'}
										onclick={() => addKit(kit.id)}
										class={quantityInList > 0 ? '' : 'flex-1'}
									>
										<Plus class="h-4 w-4" />
										{#if quantityInList === 0}
											<span class="ml-1">Add to List</span>
										{/if}
									</Button>
								</div>
							</Card.Footer>
						</Card.Root>
					{/each}
				</div>
			</div>

			<!-- Packing List Sidebar -->
			<div class="lg:col-span-1">
				<div class="sticky top-20 space-y-4">
					<div class="flex items-center justify-between">
						<h2 class="text-lg font-semibold flex items-center gap-2">
							<ShoppingCart class="h-5 w-5" />
							Packing List
						</h2>
						{#if totalKitsCount > 0}
							<Button variant="ghost" size="sm" onclick={clearPackingList}>
								Clear All
							</Button>
						{/if}
					</div>

					{#if totalKitsCount === 0}
						<Card.Root>
							<Card.Content class="py-8 text-center">
								<Package class="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
								<p class="text-muted-foreground">Your packing list is empty</p>
								<p class="text-sm text-muted-foreground">Add kits from the left to get started</p>
							</Card.Content>
						</Card.Root>
					{:else}
						<!-- Selected Kits -->
						<Card.Root>
							<Card.Header class="pb-2">
								<Card.Title class="text-sm font-medium">Selected Kits</Card.Title>
							</Card.Header>
							<Card.Content class="pb-3">
								<ul class="space-y-2">
									{#each data.kits.filter((k) => packingList.has(k.id)) as kit (kit.id)}
										{@const qty = packingList.get(kit.id) ?? 0}
										<li class="flex items-center justify-between text-sm">
											<span>{kit.name}</span>
											<div class="flex items-center gap-1">
												<Button variant="ghost" size="icon-sm" onclick={() => removeKit(kit.id)}>
													<Minus class="h-3 w-3" />
												</Button>
												<span class="w-6 text-center">{qty}x</span>
												<Button variant="ghost" size="icon-sm" onclick={() => addKit(kit.id)}>
													<Plus class="h-3 w-3" />
												</Button>
												<Button variant="ghost" size="icon-sm" onclick={() => removeKitEntirely(kit.id)}>
													<Trash2 class="h-3 w-3 text-destructive" />
												</Button>
											</div>
										</li>
									{/each}
								</ul>
							</Card.Content>
						</Card.Root>

						<!-- Combined Materials Required -->
						{#if calculatedMaterials().materials.length > 0}
							<Card.Root class={calculatedMaterials().hasShortages ? 'border-destructive' : ''}>
								<Card.Header class="pb-2">
									<div class="flex items-center justify-between">
										<Card.Title class="text-sm font-medium flex items-center gap-2">
											{#if calculatedMaterials().hasShortages}
												<AlertTriangle class="h-4 w-4 text-destructive" />
											{/if}
											Materials Required
										</Card.Title>
										<Button variant="ghost" size="icon-sm" onclick={copyMaterialsList} title="Copy to clipboard">
											{#if copiedToClipboard}
												<Check class="h-3 w-3 text-green-500" />
											{:else}
												<Copy class="h-3 w-3" />
											{/if}
										</Button>
									</div>
									{#if calculatedMaterials().hasShortages}
										<Card.Description class="text-destructive">
											Some materials are insufficient
										</Card.Description>
									{/if}
								</Card.Header>
								<Card.Content>
									<ul class="space-y-2">
										{#each calculatedMaterials().materials as material (material.materialId)}
											<li class="text-sm {material.isShort ? 'text-destructive' : ''}">
												<div class="flex items-center justify-between {material.isShort ? 'font-medium' : ''}">
													<span class="flex items-center gap-1">
														<span class="tabular-nums">{material.totalRequired}x</span>
														{material.name}
													</span>
													<span class="text-xs text-muted-foreground tabular-nums {material.isShort ? 'text-destructive' : ''}">
														{#if material.isShort}
															<span class="font-medium">-{material.totalRequired - material.available}</span>
														{:else}
															{material.available} avail.
														{/if}
													</span>
												</div>
												{#if material.breakdown.length > 1}
													<div class="text-xs text-muted-foreground mt-0.5">
														{material.breakdown.map(b => `${b.quantity}x ${b.kitName}`).join(', ')}
													</div>
												{/if}
											</li>
										{/each}
									</ul>
								</Card.Content>
							</Card.Root>
						{/if}

						<!-- Overall Status -->
						{#if calculatedMaterials().hasShortages}
							<Alert.Root variant="destructive">
								<AlertTriangle class="h-4 w-4" />
								<Alert.Title>Insufficient Materials</Alert.Title>
								<Alert.Description>
									Some required materials are not available in sufficient quantities.
								</Alert.Description>
							</Alert.Root>
						{/if}
					{/if}
				</div>
			</div>
		</div>
	{/if}
</div>
