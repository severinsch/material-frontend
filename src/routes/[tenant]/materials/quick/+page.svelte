<!--
	Schnellerfassung: entering the inventory the first time, one row at a time. Each row is saved at once; the page
	data reloads after each save, so entries of others show up too. Desktop: the input line (or plain fields);
	phone: steps.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { categoriesOf } from '#lib/categories.js';
	import MaterialDialog from '#lib/components/MaterialDialog.svelte';
	import QuickFields from '#lib/components/quick-entry/QuickFields.svelte';
	import QuickHere from '#lib/components/quick-entry/QuickHere.svelte';
	import QuickHistory from '#lib/components/quick-entry/QuickHistory.svelte';
	import QuickLine from '#lib/components/quick-entry/QuickLine.svelte';
	import QuickSteps from '#lib/components/quick-entry/QuickSteps.svelte';
	import { QuickSession } from '#lib/components/quick-entry/session.svelte.js';
	import { getTenant } from '#lib/tenant.js';

	let { data } = $props();

	const tenant = getTenant();
	const session = new QuickSession(
		() => tenant.api,
		() => data
	);
	const desktop = new MediaQuery('(width >= 48rem)');
	const categories = $derived(categoriesOf(data.materials));
	let materialDialog: MaterialDialog;

	/** Per browser: some prefer the plain fields. */
	const modeKey = 'quick-entry-mode';
	let mode: 'line' | 'fields' = $state('line');
	onMount(() => {
		if (localStorage.getItem(modeKey) === 'fields') mode = 'fields';
	});
	function setMode(value: typeof mode) {
		mode = value;
		localStorage.setItem(modeKey, value);
	}
</script>

<div class="space-y-3">
	<h1 class="text-2xl font-bold tracking-tight">Schnellerfassung</h1>

	{#if desktop.current}
		<div class="max-w-5xl space-y-2">
			<div class="flex items-center justify-between gap-4">
				<QuickHere {session} locations={data.locations} />
				<div
					class="inline-flex rounded-lg bg-muted p-0.5 text-xs"
					role="radiogroup"
					aria-label="Eingabe"
				>
					{#each [['line', 'Eingabezeile'], ['fields', 'Einzelne Felder']] as const as [value, label] (value)}
						<button
							type="button"
							role="radio"
							aria-checked={mode === value}
							class={[
								'rounded-md px-2 py-1',
								mode === value
									? 'bg-background font-medium shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							]}
							onclick={() => setMode(value)}>{label}</button
						>
					{/each}
				</div>
			</div>
			<div class="rounded-xl border p-3">
				{#if mode === 'line'}
					<QuickLine {session} {categories} />
				{:else}
					<QuickFields {session} {categories} />
				{/if}
			</div>
			<QuickHistory {session} onedit={(m) => materialDialog.show(m)} />
		</div>
	{:else}
		<QuickSteps
			{session}
			locations={data.locations}
			{categories}
			onedit={(m) => materialDialog.show(m)}
		/>
	{/if}
</div>

<MaterialDialog bind:this={materialDialog} materials={data.materials} locations={data.locations} />
