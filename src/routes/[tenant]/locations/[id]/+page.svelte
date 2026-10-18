<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { conditionLabels, statusLabels } from '#lib/format.js';
	import { availableNow } from '#lib/settings.svelte.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';
	import LocationDialog from '#lib/components/LocationDialog.svelte';

	let { data } = $props();

	const tenant = getTenant();
	const canEdit = $derived(tenant.can('EDIT'));

	let locationDialog: LocationDialog;

	const materialNames = $derived(new Map(data.materials.map((m) => [m.id, m.name])));

	/** The contents grouped by place in the location, sorted by place; things without a place come last. */
	const places = $derived.by(() => {
		const byPlace: Record<string, { bulk: typeof data.bulkMaterials; items: typeof data.items }> =
			{};
		const placeOf = (detail: string | null | undefined) =>
			(byPlace[detail?.trim() ?? ''] ??= { bulk: [], items: [] });
		for (const material of data.bulkMaterials) placeOf(material.locationDetail).bulk.push(material);
		for (const item of data.items) placeOf(item.locationDetail).items.push(item);

		const compare = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
		return Object.entries(byPlace)
			.map(([detail, { bulk, items }]) => ({
				detail,
				bulk: bulk.toSorted((a, b) => compare(a.name, b.name)),
				items: items.toSorted(
					(a, b) =>
						compare(materialNames.get(a.materialId) ?? '', materialNames.get(b.materialId) ?? '') ||
						compare(a.identifier, b.identifier)
				)
			}))
			.sort((a, b) => Number(!a.detail) - Number(!b.detail) || compare(a.detail, b.detail));
	});
</script>

<div class="space-y-6">
	<div class="space-y-2">
		<a
			href={tenant.href('/locations')}
			class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />Lagerorte
		</a>
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">{data.location.name}</h1>
				{#if data.location.description}
					<p class="text-muted-foreground">{data.location.description}</p>
				{/if}
			</div>
			{#if canEdit}
				<Button variant="outline" onclick={() => locationDialog.show(data.location)}>
					<PencilIcon />Bearbeiten
				</Button>
			{/if}
		</div>
		<p class="text-sm">
			{data.bulkMaterials.length}
			{data.bulkMaterials.length === 1 ? 'Material' : 'Materialien'} nach Menge ·
			{data.items.length}
			{data.items.length === 1 ? 'Gegenstand' : 'Gegenstände'}
		</p>
		{#if data.bulkMaterials.length > 0}<LoanedToggle />{/if}
	</div>

	{#each places as place (place.detail)}
		<section class="space-y-2">
			<h2 class={['text-lg font-semibold', !place.detail && 'text-muted-foreground']}>
				{place.detail || 'Ohne Platzangabe'}
			</h2>
			<ul class="divide-y rounded-md border">
				{#each place.bulk as material (material.id)}
					<li class="flex items-center justify-between gap-4 px-3 py-2">
						<a href={tenant.href(`/materials/${material.id}`)} class="font-medium hover:underline">
							{material.name}
						</a>
						<span class="text-sm text-muted-foreground tabular-nums">
							{availableNow(material)} verfügbar{material.damagedCount > 0
								? ` · ${material.damagedCount} beschädigt`
								: ''}
						</span>
					</li>
				{/each}
				{#each place.items as item (item.id)}
					<li class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2">
						<a
							href={tenant.href(`/materials/${item.materialId}`)}
							class="font-medium hover:underline"
						>
							{materialNames.get(item.materialId)}
							{item.identifier}
						</a>
						<span class="flex flex-wrap items-center gap-1">
							{#if item.onLoan}<Badge variant="secondary">ausgeliehen</Badge>{/if}
							{#if item.status !== 'ACTIVE'}
								<Badge variant="secondary">{statusLabels[item.status]}</Badge>
							{/if}
							<Badge variant={item.condition === 'POOR' ? 'destructive' : 'outline'}>
								{conditionLabels[item.condition]}
							</Badge>
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{:else}
		<p class="text-muted-foreground">Hier ist nichts gelagert.</p>
	{/each}
</div>

<LocationDialog bind:this={locationDialog} />
