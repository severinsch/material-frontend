<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import type { KitGroup } from '#lib/api/index.js';
	import { allocate } from '#lib/kits/allocate.js';
	import { availableNow } from '#lib/settings.svelte.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';

	let { data } = $props();

	/** Selected kits: kit id → quantity. */
	const quantities = new SvelteMap<string, number>();
	/** Included optional groups as `kitId/groupIndex`. */
	const includedGroups = new SvelteSet<string>();
	let copied = $state(false);

	const materials = $derived(new Map(data.materials.map((material) => [material.id, material])));
	const kitNames = $derived(new Map(data.kits.map((kit) => [kit.id, kit.name])));
	const selectedKits = $derived(data.kits.filter((kit) => quantities.has(kit.id)));

	const needs = $derived.by(() => {
		const selections = selectedKits.map((kit) => ({
			kit,
			quantity: quantities.get(kit.id)!,
			includedGroups: new Set(
				kit.groups.keys().filter((index) => includedGroups.has(`${kit.id}/${index}`))
			)
		}));
		const stock = new Map(data.materials.map((material) => [material.id, availableNow(material)]));
		return allocate(selections, stock)
			.map((need) => ({
				...need,
				name: nameOf(need.materialId),
				missing: need.required - need.available
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	});
	const hasShortages = $derived(needs.some((need) => need.missing > 0));

	function nameOf(materialId: string) {
		return materials.get(materialId)?.name ?? 'Unknown material';
	}

	function groupLabel(group: KitGroup) {
		return group.name ?? group.options.map((option) => nameOf(option.materialId)).join(' / ');
	}

	function setQuantity(kitId: string, quantity: number) {
		if (quantity > 0) quantities.set(kitId, quantity);
		else quantities.delete(kitId);
	}

	function toggleGroup(key: string, include: boolean) {
		if (include) includedGroups.add(key);
		else includedGroups.delete(key);
	}

	async function copyList() {
		await navigator.clipboard.writeText(
			needs.map((need) => `${need.required}x ${need.name}`).join('\n')
		);
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

<div class="space-y-4">
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Kits</h1>
			<p class="text-muted-foreground">Select kits to see which materials to pack.</p>
		</div>
		<Button href="/kits/new"><PlusIcon />New kit</Button>
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<div class="grid content-start gap-4 sm:grid-cols-2 lg:col-span-2">
			{#each data.kits as kit (kit.id)}
				{@const quantity = quantities.get(kit.id) ?? 0}
				<Card.Root>
					<Card.Header>
						<Card.Title>{kit.name}</Card.Title>
						{#if kit.description}<Card.Description>{kit.description}</Card.Description>{/if}
						<Card.Action>
							<Button variant="ghost" size="icon-sm" href="/kits/{kit.id}" aria-label="Edit kit">
								<PencilIcon />
							</Button>
						</Card.Action>
					</Card.Header>
					<Card.Content>
						<ul class="space-y-2 text-sm">
							{#each kit.groups as group, index (index)}
								{@const key = `${kit.id}/${index}`}
								<li>
									<div class="flex items-center gap-2">
										{#if group.isOptional}
											<Checkbox
												id={key}
												checked={includedGroups.has(key)}
												onCheckedChange={(checked) => toggleGroup(key, checked)}
											/>
										{/if}
										<label
											for={key}
											class={group.isOptional && !includedGroups.has(key)
												? 'text-muted-foreground'
												: ''}
										>
											{group.requiredUnits}× {groupLabel(group)}
										</label>
										{#if group.isOptional}<Badge variant="outline">optional</Badge>{/if}
									</div>
									{#if group.options.length > 1 || group.options[0].unitValue > 1}
										<ul class="mt-1 ml-3 border-l pl-2 text-xs text-muted-foreground">
											{#each group.options.toSorted((a, b) => a.priority - b.priority) as option (option.materialId)}
												<li>
													{nameOf(option.materialId)}
													{#if option.unitValue > 1}(counts {option.unitValue}×){/if}
												</li>
											{/each}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					</Card.Content>
					<Card.Footer class="gap-2">
						{#if quantity > 0}
							<Button
								variant="outline"
								size="icon-sm"
								aria-label="Fewer"
								onclick={() => setQuantity(kit.id, quantity - 1)}
							>
								<MinusIcon />
							</Button>
							<span class="w-6 text-center font-medium tabular-nums">{quantity}</span>
							<Button
								variant="outline"
								size="icon-sm"
								aria-label="More"
								onclick={() => setQuantity(kit.id, quantity + 1)}
							>
								<PlusIcon />
							</Button>
						{:else}
							<Button size="sm" class="flex-1" onclick={() => setQuantity(kit.id, 1)}
								><PlusIcon />Add to list</Button
							>
						{/if}
					</Card.Footer>
				</Card.Root>
			{:else}
				<p class="text-muted-foreground">No kits yet.</p>
			{/each}
		</div>

		<aside class="space-y-4 lg:sticky lg:top-20 lg:self-start">
			<div class="flex items-center justify-between">
				<h2 class="text-lg font-semibold">Packing list</h2>
				{#if selectedKits.length > 0}
					<Button variant="ghost" size="sm" onclick={() => quantities.clear()}>Clear</Button>
				{/if}
			</div>
			<LoanedToggle />

			{#if selectedKits.length === 0}
				<p class="text-sm text-muted-foreground">Add kits to see the materials they need.</p>
			{:else}
				<Card.Root class={hasShortages ? 'border-destructive' : ''}>
					<Card.Header>
						<Card.Title
							>{selectedKits
								.map((kit) => `${quantities.get(kit.id)}× ${kit.name}`)
								.join(', ')}</Card.Title
						>
						{#if hasShortages}
							<Card.Description class="text-destructive">Some materials are short.</Card.Description
							>
						{/if}
						<Card.Action>
							<Button variant="ghost" size="icon-sm" aria-label="Copy list" onclick={copyList}>
								{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
							</Button>
						</Card.Action>
					</Card.Header>
					<Card.Content>
						<ul class="space-y-2 text-sm">
							{#each needs as need (need.materialId)}
								<li class={need.missing > 0 ? 'text-destructive' : ''}>
									<div class="flex justify-between gap-2">
										<span><span class="tabular-nums">{need.required}×</span> {need.name}</span>
										<span
											class="text-xs tabular-nums {need.missing > 0
												? 'font-medium'
												: 'text-muted-foreground'}"
										>
											{need.missing > 0 ? `${need.missing} missing` : `${need.available} available`}
										</span>
									</div>
									{#if need.byKit.length > 1}
										<p class="text-xs text-muted-foreground">
											{need.byKit
												.map((part) => `${part.quantity}× ${kitNames.get(part.kitId)}`)
												.join(', ')}
										</p>
									{/if}
								</li>
							{/each}
						</ul>
					</Card.Content>
				</Card.Root>
			{/if}
		</aside>
	</div>
</div>
