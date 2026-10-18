<script lang="ts">
	import type { Snippet } from 'svelte';
	import { conditionLabels, formatDate, statusLabels } from '#lib/format.js';
	import { isOverdue, loanContents } from '#lib/loans.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import * as Card from '#lib/components/ui/card/index.js';

	let { data } = $props();

	const tenant = getTenant();

	const materials = $derived(new Map(data.materials.map((m) => [m.id, m])));
	const items = $derived(new Map(data.items.map((item) => [item.id, item])));

	const overdueLoans = $derived(data.loans.filter(isOverdue));
	const otherOpenLoans = $derived(data.loans.filter((loan) => !isOverdue(loan)));
	/** Items that need attention: in repair, or active but in poor condition. */
	const damagedItems = $derived(
		data.items
			.filter(
				(item) =>
					item.status === 'IN_REPAIR' || (item.status === 'ACTIVE' && item.condition === 'POOR')
			)
			.toSorted((a, b) =>
				itemName(a.id).localeCompare(itemName(b.id), undefined, { numeric: true })
			)
	);

	function itemName(itemId: string) {
		const item = items.get(itemId);
		return item
			? `${materials.get(item.materialId)?.name} ${item.identifier}`
			: 'Unbekannter Gegenstand';
	}
</script>

{#snippet section(
	title: string,
	count: number,
	href: string | undefined,
	empty: string,
	content: Snippet
)}
	<Card.Root>
		<Card.Header>
			<Card.Title>
				<h2>
					{#if href}<a {href} class="hover:underline">{title}</a>{:else}{title}{/if}
					<span class="text-muted-foreground tabular-nums">({count})</span>
				</h2>
			</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if count === 0}
				<p class="text-sm text-muted-foreground">{empty}</p>
			{:else}
				<ul class="divide-y text-sm">{@render content()}</ul>
			{/if}
		</Card.Content>
	</Card.Root>
{/snippet}

<div class="space-y-4">
	<div>
		<h1 class="text-2xl font-bold tracking-tight">Übersicht</h1>
		<p class="text-muted-foreground">Was gerade Aufmerksamkeit braucht.</p>
	</div>

	<div class="grid gap-4 md:grid-cols-2">
		{#snippet overdue()}
			{#each overdueLoans as loan (loan.id)}
				<li class="py-2">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<span class="font-medium">{loan.borrower}</span>
						<Badge variant="destructive">überfällig seit {formatDate(loan.dueAt)}</Badge>
					</div>
					<p class="text-muted-foreground">{loanContents(loan, materials, items)}</p>
				</li>
			{/each}
		{/snippet}
		{@render section(
			'Überfällige Ausleihen',
			overdueLoans.length,
			tenant.href('/loans'),
			'Keine Ausleihe ist überfällig.',
			overdue
		)}

		{#snippet open()}
			{#each otherOpenLoans as loan (loan.id)}
				<li class="py-2">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<span class="font-medium">{loan.borrower}</span>
						<span class="text-muted-foreground">
							{loan.dueAt ? `Rückgabe bis ${formatDate(loan.dueAt)}` : 'ohne Rückgabedatum'}
						</span>
					</div>
					<p class="text-muted-foreground">{loanContents(loan, materials, items)}</p>
				</li>
			{/each}
		{/snippet}
		{@render section(
			'Offene Ausleihen',
			otherOpenLoans.length,
			tenant.href('/loans'),
			'Sonst ist nichts ausgeliehen.',
			open
		)}

		{#snippet damaged()}
			{#each damagedItems as item (item.id)}
				<li class="flex flex-wrap items-center justify-between gap-2 py-2">
					<a
						href={tenant.href(`/materials/${item.materialId}`)}
						class="font-medium hover:underline"
					>
						{itemName(item.id)}
					</a>
					{#if item.status === 'IN_REPAIR'}
						<Badge variant="secondary">{statusLabels[item.status]}</Badge>
					{:else}
						<Badge variant="destructive">{conditionLabels[item.condition]}</Badge>
					{/if}
				</li>
			{/each}
		{/snippet}
		{@render section(
			'In Reparatur oder in schlechtem Zustand',
			damagedItems.length,
			undefined,
			'Alle Gegenstände sind in Ordnung.',
			damaged
		)}

		{#snippet damages()}
			{#each data.openDamages as report (report.id)}
				{@const item = items.get(report.itemId)}
				<li class="py-2">
					<p>
						<a
							href={item ? tenant.href(`/materials/${item.materialId}`) : undefined}
							class="font-medium hover:underline">{itemName(report.itemId)}</a
						>: {report.description}
					</p>
					<p class="text-muted-foreground">
						Gemeldet am {formatDate(report.reportedAt)}{report.reportedBy
							? ` von ${report.reportedBy}`
							: ''}
					</p>
				</li>
			{/each}
		{/snippet}
		{@render section(
			'Offene Schadensmeldungen',
			data.openDamages.length,
			undefined,
			'Keine offenen Schadensmeldungen.',
			damages
		)}
	</div>
</div>
