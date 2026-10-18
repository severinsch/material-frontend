<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import { formatDate, today } from '#lib/format.js';
	import { allocate } from '#lib/kits/allocate.js';
	import {
		byPlace,
		describeShortage,
		parseSelection,
		placeOf,
		serializeSelection,
		type PackingSelection
	} from '#lib/kits/packing.js';
	import { availableNow, settings } from '#lib/settings.svelte.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';

	let { data } = $props();

	const tenant = getTenant();
	const canEdit = $derived(tenant.can('EDIT'));

	/** Selected kits: kit id → quantity. */
	const quantities = new SvelteMap<string, number>();
	/** Included optional groups as `kitId/groupIndex`. */
	const includedGroups = new SvelteSet<string>();
	let copied = $state(false);

	// The packing list lives in the URL (see parseSelection), so it survives reloads and can be shared as a link.
	function restore(selection: PackingSelection) {
		quantities.clear();
		includedGroups.clear();
		for (const [kitId, { quantity, includedGroups: groups }] of selection) {
			quantities.set(kitId, quantity);
			for (const index of groups) includedGroups.add(`${kitId}/${index}`);
		}
	}
	// svelte-ignore state_referenced_locally
	restore(parseSelection(page.url.searchParams, data.kits));
	/** replaceState only works once the router has started. */
	let routerReady = $state(false);
	afterNavigate(({ type }) => {
		if (type !== 'enter') restore(parseSelection(page.url.searchParams, data.kits));
		routerReady = true;
	});

	const selection: PackingSelection = $derived(
		new Map(
			[...quantities].map(([kitId, quantity]) => [
				kitId,
				{ quantity, includedGroups: includedIndices(kitId) }
			])
		)
	);

	$effect(() => {
		if (!routerReady) return;
		// Based on `location`, not `page`: this effect must only depend on the selection, since replaceState changes
		// `page.state`.
		const url = new URL(location.href);
		url.searchParams.delete('kit');
		for (const value of serializeSelection(selection)) url.searchParams.append('kit', value);
		if (url.search !== location.search) replaceState(url, {});
	});

	const materials = $derived(new Map(data.materials.map((material) => [material.id, material])));
	const kits = $derived(new Map(data.kits.map((kit) => [kit.id, kit])));
	const selectedKits = $derived(data.kits.filter((kit) => quantities.has(kit.id)));
	const kitCount = $derived([...quantities.values()].reduce((sum, quantity) => sum + quantity, 0));

	const allocation = $derived.by(() => {
		const selections = selectedKits.map((kit) => ({
			kit,
			quantity: quantities.get(kit.id)!,
			includedGroups: includedIndices(kit.id)
		}));
		const stock = new Map(data.materials.map((material) => [material.id, availableNow(material)]));
		return allocate(selections, stock);
	});
	const needs = $derived(
		allocation.needs
			.map((need) => {
				const material = materials.get(need.materialId);
				return {
					...need,
					name: nameOf(need.materialId),
					missing: Math.max(0, need.required - need.available),
					place: material
						? placeOf(material, data.items, settings.subtractLoaned)
						: { location: 'Ohne Lagerort', detail: '' }
				};
			})
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const shortages = $derived(
		allocation.shortages.map((shortage) =>
			describeShortage(shortage, kits.get(shortage.kitId)!, nameOf)
		)
	);
	/** Needs grouped by storage location for the printed list. */
	const needsByLocation = $derived([
		...Map.groupBy(
			needs.toSorted((a, b) => byPlace(a.place, b.place)),
			(need) => need.place.location
		)
	]);
	const selectedSummary = $derived(
		selectedKits.map((kit) => `${quantities.get(kit.id)}× ${kit.name}`).join(', ')
	);

	function includedIndices(kitId: string) {
		const kit = kits.get(kitId);
		return new Set(
			(kit?.groups ?? []).flatMap((_, index) =>
				includedGroups.has(`${kitId}/${index}`) ? [index] : []
			)
		);
	}

	function availableOf(materialId: string) {
		const material = materials.get(materialId);
		return material ? availableNow(material) : 0;
	}

	function nameOf(materialId: string) {
		return materials.get(materialId)?.name ?? 'Unbekanntes Material';
	}

	function missingText(count: number) {
		return `${count} ${count === 1 ? 'fehlt' : 'fehlen'}`;
	}

	/** Pieces of a material with [unitValue] needed to fill [units] in one kit. */
	function piecesFor(units: number, unitValue: number) {
		return Math.ceil(units / unitValue);
	}

	function setQuantity(kitId: string, quantity: number) {
		if (quantity > 0) quantities.set(kitId, quantity);
		else quantities.delete(kitId);
	}

	function toggleGroup(key: string, include: boolean) {
		if (include) includedGroups.add(key);
		else includedGroups.delete(key);
	}

	function listText() {
		const lines = [`Packliste: ${selectedSummary}`];
		for (const [location, located] of needsByLocation) {
			lines.push('', location);
			for (const need of located) {
				const detail = need.place.detail ? ` (${need.place.detail})` : '';
				const missing = need.missing > 0 ? ` – ${missingText(need.missing)}` : '';
				lines.push(`- ${need.required}× ${need.name}${detail}${missing}`);
			}
		}
		if (shortages.length > 0) lines.push('', 'Fehlt:', ...shortages.map((text) => `- ${text}`));
		return lines.join('\n');
	}

	async function copyList() {
		// The clipboard API only exists on HTTPS (and localhost).
		const success = await navigator.clipboard?.writeText(listText()).then(
			() => true,
			() => false
		);
		if (!success) {
			toast.error('Die Liste konnte nicht kopiert werden. Kopieren geht nur über HTTPS.');
			return;
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

{#snippet availability(materialId: string, needed = 0)}
	{@const available = availableOf(materialId)}
	<span
		class="shrink-0 text-xs tabular-nums {needed > available
			? 'text-destructive'
			: 'text-muted-foreground'}"
	>
		{available} verfügbar
	</span>
{/snippet}

{#snippet quantityButtons(kitId: string, name: string, quantity: number)}
	<Button
		variant="outline"
		size="icon-sm"
		aria-label="Weniger {name}"
		onclick={() => setQuantity(kitId, quantity - 1)}
	>
		<MinusIcon />
	</Button>
	<span class="w-6 text-center font-medium tabular-nums"
		>{quantity}<span class="sr-only">× {name}</span></span
	>
	<Button
		variant="outline"
		size="icon-sm"
		aria-label="Mehr {name}"
		onclick={() => setQuantity(kitId, quantity + 1)}
	>
		<PlusIcon />
	</Button>
{/snippet}

<div class={['space-y-4 print:hidden', selectedKits.length > 0 && 'pb-14 lg:pb-0']}>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Sets</h1>
			<p class="text-muted-foreground">Wähle Sets aus, um zu sehen, was eingepackt werden muss.</p>
		</div>
		{#if canEdit}
			<Button href={tenant.href('/kits/new')}><PlusIcon />Set anlegen</Button>
		{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<div class="grid content-start gap-4 sm:grid-cols-2 lg:col-span-2">
			{#each data.kits as kit (kit.id)}
				{@const quantity = quantities.get(kit.id) ?? 0}
				<Card.Root>
					<Card.Header>
						<Card.Title>{kit.name}</Card.Title>
						{#if kit.description}<Card.Description>{kit.description}</Card.Description>{/if}
						{#if canEdit}
							<Card.Action>
								<Button
									variant="ghost"
									size="icon-sm"
									href={tenant.href(`/kits/${kit.id}`)}
									aria-label="{kit.name} bearbeiten"
									title="Bearbeiten"
								>
									<PencilIcon />
								</Button>
							</Card.Action>
						{/if}
					</Card.Header>
					<Card.Content>
						<ul class="space-y-2 text-sm">
							{#each kit.groups as group, index (index)}
								{@const key = `${kit.id}/${index}`}
								{@const excluded = group.isOptional && !includedGroups.has(key)}
								{@const [single] = group.options.length === 1 ? group.options : []}
								<li class={excluded ? 'text-muted-foreground' : ''}>
									<div class="flex items-center gap-2">
										{#if group.isOptional}
											<Checkbox
												id={key}
												checked={includedGroups.has(key)}
												onCheckedChange={(checked) => toggleGroup(key, checked)}
											/>
										{/if}
										<label for={key} class="flex-1">
											{#if single}
												{piecesFor(group.requiredUnits, single.unitValue)}× {nameOf(
													single.materialId
												)}
												{#if group.name}<span class="text-muted-foreground">({group.name})</span
													>{/if}
											{:else}
												{group.name ?? 'Alternativen'}
												<span class="text-muted-foreground">· {group.requiredUnits} Einheiten</span>
											{/if}
										</label>
										{#if group.isOptional}<Badge variant="outline">optional</Badge>{/if}
										{#if single}
											{@render availability(
												single.materialId,
												piecesFor(group.requiredUnits, single.unitValue)
											)}
										{/if}
									</div>
									{#if !single}
										<ul class="mt-1 ml-1 space-y-0.5 border-l pl-2 text-xs">
											{#each group.options.toSorted((a, b) => a.priority - b.priority) as option, rank (option.materialId)}
												{@const pieces = piecesFor(group.requiredUnits, option.unitValue)}
												<li class="flex items-center gap-1.5">
													<span class="flex-1">
														{#if rank > 0}<span class="text-muted-foreground">oder</span>{/if}
														{pieces}× {nameOf(option.materialId)}
														{#if rank === 0}
															<Badge variant="secondary" class="ml-1 px-1.5 py-0 text-[0.7rem]"
																>bevorzugt</Badge
															>
														{/if}
													</span>
													{@render availability(option.materialId)}
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
							{@render quantityButtons(kit.id, kit.name, quantity)}
							<span class="text-sm text-muted-foreground">auf der Packliste</span>
						{:else}
							<Button
								size="sm"
								class="flex-1"
								aria-label="{kit.name} zur Packliste hinzufügen"
								onclick={() => setQuantity(kit.id, 1)}><PlusIcon />Zur Packliste</Button
							>
						{/if}
					</Card.Footer>
				</Card.Root>
			{:else}
				<p class="text-muted-foreground">Noch keine Sets.</p>
			{/each}
		</div>

		<aside
			id="packliste"
			aria-labelledby="packliste-heading"
			class="scroll-mt-20 space-y-4 lg:sticky lg:top-20 lg:self-start"
		>
			<div class="flex items-center justify-between gap-2">
				<h2 id="packliste-heading" class="text-lg font-semibold">Packliste</h2>
				{#if selectedKits.length > 0}
					<div class="flex">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Liste kopieren"
							title="Liste kopieren"
							onclick={copyList}
						>
							{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Drucken"
							title="Drucken"
							onclick={() => window.print()}
						>
							<PrinterIcon />
						</Button>
						<Button variant="ghost" size="sm" onclick={() => quantities.clear()}>Leeren</Button>
					</div>
				{/if}
			</div>
			<LoanedToggle />

			{#if selectedKits.length === 0}
				<p class="text-sm text-muted-foreground">
					Füge Sets hinzu, um zu sehen, welche Materialien sie brauchen.
				</p>
			{:else}
				<Card.Root>
					<Card.Header>
						<Card.Title>Ausgewählte Sets</Card.Title>
					</Card.Header>
					<Card.Content>
						<ul class="space-y-1 text-sm">
							{#each selectedKits as kit (kit.id)}
								<li class="flex items-center gap-1">
									<span class="flex-1">{kit.name}</span>
									{@render quantityButtons(kit.id, kit.name, quantities.get(kit.id) ?? 0)}
									<Button
										variant="ghost"
										size="icon-sm"
										aria-label="{kit.name} von der Packliste entfernen"
										title="Entfernen"
										onclick={() => setQuantity(kit.id, 0)}
									>
										<Trash2Icon />
									</Button>
								</li>
							{/each}
						</ul>
					</Card.Content>
				</Card.Root>

				{#if shortages.length > 0}
					<Card.Root class="border-destructive">
						<Card.Header>
							<Card.Title class="text-destructive">Nicht genug Material</Card.Title>
						</Card.Header>
						<Card.Content>
							<ul class="space-y-1 text-sm">
								{#each shortages as text, index (index)}
									<li>{text}</li>
								{/each}
							</ul>
						</Card.Content>
					</Card.Root>
				{/if}

				<Card.Root>
					<Card.Header>
						<Card.Title>Benötigte Materialien</Card.Title>
					</Card.Header>
					<Card.Content>
						<ul class="space-y-2 text-sm">
							{#each needs as need (need.materialId)}
								<li class={need.missing > 0 ? 'text-destructive' : ''}>
									<div class="flex justify-between gap-2">
										<span><span class="tabular-nums">{need.required}×</span> {need.name}</span>
										<span
											class="shrink-0 text-xs tabular-nums {need.missing > 0
												? 'font-medium'
												: 'text-muted-foreground'}"
										>
											{need.missing > 0 ? missingText(need.missing) : `${need.available} verfügbar`}
										</span>
									</div>
									<p class="text-xs text-muted-foreground">
										{[need.place.location, need.place.detail].filter(Boolean).join(': ')}
										{#if need.byKit.length > 1}
											· {need.byKit
												.map((part) => `${part.quantity}× für ${kits.get(part.kitId)?.name}`)
												.join(', ')}
										{/if}
									</p>
								</li>
							{/each}
						</ul>
					</Card.Content>
				</Card.Root>
			{/if}
		</aside>
	</div>
</div>

<!-- On phones the packing list is below all kits; this bar jumps there. It sits above the bottom navigation. -->
{#if selectedKits.length > 0}
	<div class="fixed inset-x-0 bottom-16 z-40 px-4 pb-2 sm:bottom-0 lg:hidden print:hidden">
		<Button href="#packliste" class="h-11 w-full shadow-lg">
			Packliste ({kitCount}
			{kitCount === 1 ? 'Set' : 'Sets'}){shortages.length > 0 ? ' · Material fehlt' : ''}
		</Button>
	</div>
{/if}

<!-- The printed packing list, grouped by where things are stored, to tick off while packing. -->
<section class="hidden space-y-4 text-sm text-black print:block">
	<header>
		<h1 class="text-xl font-bold">Packliste vom {formatDate(today())}</h1>
		<p>{selectedSummary}</p>
	</header>
	{#if shortages.length > 0}
		<div class="rounded border border-black p-2">
			<h2 class="font-semibold">Nicht genug Material</h2>
			<ul class="list-disc pl-5">
				{#each shortages as text, index (index)}<li>{text}</li>{/each}
			</ul>
		</div>
	{/if}
	{#each needsByLocation as [location, located] (location)}
		<div class="break-inside-avoid">
			<h2 class="border-b border-black font-semibold">{location}</h2>
			<ul>
				{#each located as need (need.materialId)}
					<li class="flex items-baseline gap-2 border-b border-gray-300 py-1">
						<span class="inline-block size-3.5 shrink-0 border border-black"></span>
						<span class="w-12 text-right tabular-nums">{need.required}×</span>
						<span class="flex-1">
							{need.name}
							{#if need.place.detail}<span class="text-gray-600">({need.place.detail})</span>{/if}
						</span>
						{#if need.missing > 0}<span class="font-semibold">{missingText(need.missing)}</span
							>{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>
