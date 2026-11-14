<script lang="ts">
	import type { Snippet } from 'svelte';
	import {
		conditionLabels,
		formatDate,
		itemNameOf,
		statusLabels,
		variantName
	} from '#lib/format.js';
	import ArrowRightIcon from '@lucide/svelte/icons/arrow-right';
	import { isOverdue, loanContents } from '#lib/loans.js';
	import { groupLabels, grouped } from '#lib/tasks.js';
	import { provideTaskData } from '#lib/components/tasks/context.svelte.js';
	import TaskDialogs from '#lib/components/tasks/TaskDialogs.svelte';
	import TaskList from '#lib/components/tasks/TaskList.svelte';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import * as Card from '#lib/components/ui/card/index.js';

	let { data } = $props();

	const tenant = getTenant();

	const taskData = provideTaskData(() => data);
	let taskDialogs: TaskDialogs;
	const openTasks = $derived(data.tasks.filter((t) => !t.completedAt));
	/** Overdue and due in the next 2 weeks. */
	const dueTasks = $derived(
		grouped(openTasks).filter((g) => g.group === 'overdue' || g.group === 'soon')
	);
	const dueCount = $derived(dueTasks.reduce((sum, g) => sum + g.tasks.length, 0));
	/** Due later or without a date. */
	const otherTasks = $derived(openTasks.length - dueCount);

	const variants = $derived(taskData.targets.variants);
	const items = $derived(taskData.targets.items);

	const overdueLoans = $derived(data.loans.filter(isOverdue));
	const otherOpenLoans = $derived(data.loans.filter((loan) => !isOverdue(loan)));
	/** Archived materials are no longer in use, so their damage needs no attention (items and reports alike). */
	const archivedIds = $derived(
		new Set(data.materials.filter((m) => m.archivedAt).map((material) => material.id))
	);
	/** Items that need attention: in repair, or active but in poor condition. */
	const damagedItems = $derived(
		data.items
			.filter(
				(item) =>
					!archivedIds.has(item.materialId) &&
					(item.status === 'IN_REPAIR' || (item.status === 'ACTIVE' && item.condition === 'POOR'))
			)
			.toSorted((a, b) =>
				itemName(a.id).localeCompare(itemName(b.id), undefined, { numeric: true })
			)
	);

	/**
	 * Bulk stock marked as damaged, per variant, e.g. a few bent Heringe. Listed apart from the items and more
	 * quietly, since it usually matters much less than a torn tent.
	 */
	const damagedStock = $derived(
		data.materials
			.flatMap((material) =>
				material.trackingType === 'BULK' && !material.archivedAt
					? material.variants
							.filter((variant) => variant.damagedCount > 0)
							.map((variant) => ({
								id: variant.id,
								materialId: material.id,
								name: variantName(material, variant),
								count: variant.damagedCount
							}))
					: []
			)
			.toSorted((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
	);

	/** Open damage reports, without those of archived materials. */
	const openDamages = $derived(
		data.openDamages.filter((report) => {
			const item = items.get(report.itemId);
			return !item || !archivedIds.has(item.materialId);
		})
	);

	function itemName(itemId: string) {
		const item = items.get(itemId);
		return item ? itemNameOf(variants, item) : 'Unbekannter Gegenstand';
	}
</script>

{#snippet section(
	title: string,
	count: number,
	href: string | undefined,
	empty: string,
	content: Snippet,
	after?: Snippet
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
			{@render after?.()}
		</Card.Content>
	</Card.Root>
{/snippet}

<div class="space-y-4">
	<h1 class="text-2xl font-bold tracking-tight">Übersicht</h1>

	<div class="grid gap-4 md:grid-cols-2">
		<!-- Tasks first: the app is opened rarely, so what's due should be seen at once. -->
		<Card.Root>
			<Card.Header>
				<Card.Title>
					<h2>
						<a href={tenant.href('/tasks')} class="hover:underline">Aufgaben</a>
						<span class="text-muted-foreground tabular-nums">({dueCount})</span>
					</h2>
				</Card.Title>
			</Card.Header>
			<Card.Content class="space-y-3">
				{#if dueCount === 0}
					<p class="text-sm text-muted-foreground">In den nächsten 2 Wochen ist nichts fällig.</p>
				{/if}
				{#each dueTasks as { group, tasks } (group)}
					<div class="space-y-1">
						<h3
							class={[
								'text-xs font-medium',
								group === 'overdue' ? 'text-destructive/80' : 'text-muted-foreground'
							]}
						>
							{groupLabels[group]}
						</h3>
						<TaskList
							groups={[{ group: null, tasks }]}
							onopen={(task) => taskDialogs.show(task)}
							oncheck={(task) => taskDialogs.check(task)}
							dense
						/>
					</div>
				{/each}
				<p class="text-sm text-muted-foreground">
					{#if otherTasks > 0}{otherTasks} weitere ·{/if}
					<a
						href={tenant.href('/tasks')}
						class="inline-flex items-center gap-1 hover:text-foreground hover:underline"
						>Alle Aufgaben<ArrowRightIcon class="size-3.5" /></a
					>
				</p>
			</Card.Content>
		</Card.Root>

		{#snippet overdue()}
			{#each overdueLoans as loan (loan.id)}
				<li class="py-2">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<span class="font-medium">{loan.borrower}</span>
						<Badge variant="destructive">überfällig seit {formatDate(loan.dueAt)}</Badge>
					</div>
					<p class="text-muted-foreground">{loanContents(loan, variants, items)}</p>
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
					<p class="text-muted-foreground">{loanContents(loan, variants, items)}</p>
				</li>
			{/each}
		{/snippet}
		{@render section(
			'Offene Ausleihen',
			otherOpenLoans.length,
			tenant.href('/loans'),
			overdueLoans.length > 0 ? 'Sonst ist nichts ausgeliehen.' : 'Nichts ist ausgeliehen.',
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
		{#snippet stock()}
			{#if damagedStock.length > 0}
				<div class="mt-3 border-t pt-3 text-sm text-muted-foreground">
					<h3 class="font-medium">Beschädigter Bestand</h3>
					<ul class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
						{#each damagedStock as entry (entry.id)}
							<li>
								<a href={tenant.href(`/materials/${entry.materialId}`)} class="hover:underline"
									>{entry.name}</a
								>: <span class="tabular-nums">{entry.count}</span>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		{/snippet}
		{@render section(
			'In Reparatur oder in schlechtem Zustand',
			damagedItems.length,
			undefined,
			damagedStock.length > 0
				? 'Kein Gegenstand ist in Reparatur oder in schlechtem Zustand.'
				: 'Alles ist in Ordnung.',
			damaged,
			stock
		)}

		{#snippet damages()}
			{#each openDamages as report (report.id)}
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
			openDamages.length,
			undefined,
			'Keine offenen Schadensmeldungen.',
			damages
		)}
	</div>
</div>

<TaskDialogs bind:this={taskDialogs} />
