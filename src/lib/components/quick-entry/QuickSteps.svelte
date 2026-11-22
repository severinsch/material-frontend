<!--
	The phone flow, one question per screen: Was? → Menge oder einzeln? (new materials) → Wie viele? → Kategorie
	(new materials) → Speichern. The button stays in the same place at the bottom.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import HashIcon from '@lucide/svelte/icons/hash';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import type { StorageLocation } from '#lib/api/index.js';
	import type { CategoryUse } from '#lib/categories.js';
	import { suggestCategories } from '#lib/categories.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { compactList, similarMaterials } from '#lib/quick-entry.js';
	import NumberGrid from './NumberGrid.svelte';
	import QuickHere from './QuickHere.svelte';
	import QuickHistory from './QuickHistory.svelte';
	import QuickStatus from './QuickStatus.svelte';
	import { emptyDraft, type Draft, type Kind, type QuickSession } from './session.svelte.js';
	import type { Material } from '#lib/api/index.js';

	let {
		session,
		locations,
		categories,
		onedit
	}: {
		session: QuickSession;
		locations: StorageLocation[];
		categories: CategoryUse[];
		onedit: (material: Material) => void;
	} = $props();

	type Step = 'name' | 'kind' | 'count' | 'category';

	let step: Step = $state('name');
	let draft: Draft = $state(fresh());
	let editNumbers = $state(false);
	/** Whether the grid started from the automatic numbering (see `NumberGrid`). */
	let numbersAuto = $state(false);
	/** Marks the chosen card only after a choice, so nothing looks preselected. */
	let kindChosen = $state(false);
	let nameInput: HTMLInputElement | null = $state(null);

	const plan = $derived(session.plan(draft));
	const existing = $derived(plan.match.kind === 'existing' ? plan.match : null);
	const similar = $derived(similarMaterials(session.materials, draft.name, 6));
	const steps = $derived<Step[]>(
		existing ? ['name', 'count'] : ['name', 'kind', 'count', 'category']
	);
	const isLast = $derived(steps.indexOf(step) === steps.length - 1);
	const canGo = $derived(
		step === 'name'
			? !!draft.name.trim() && (plan.match.kind === 'existing' || plan.match.kind === 'new')
			: step === 'count'
				? plan.problem === null
				: true
	);
	/** Matching ones while typing; once one is chosen, the usual ones again, with the chosen one among them. */
	const categoryChips = $derived.by(() => {
		const chosen = draft.category.trim();
		if (!categories.some((c) => c.name === chosen))
			return suggestCategories(categories, chosen, 12);
		const usual = suggestCategories(categories, '', 12);
		return usual.includes(chosen) ? usual : [chosen, ...usual.slice(0, 11)];
	});

	onMount(() => {
		session.focusInput = () => nameInput?.focus();
	});

	function fresh(): Draft {
		return { ...emptyDraft(session.category), count: 1 };
	}

	async function next() {
		if (!canGo || session.saving) return;
		if (!isLast) {
			step = steps[steps.indexOf(step) + 1];
			return;
		}
		await session.save(draft, () => {
			draft = fresh();
			editNumbers = false;
			kindChosen = false;
			step = 'name';
		});
	}

	/** Numbers picked for one material don't carry over to another name. */
	function rename(name: string) {
		draft.name = name;
		draft.identifiers = null;
		editNumbers = false;
	}

	function back() {
		step = steps[Math.max(0, steps.indexOf(step) - 1)];
	}

	function chooseKind(kind: Kind) {
		draft.kind = kind;
		kindChosen = true;
		void next();
	}

	/** Null while the field is empty, so it can be retyped; the button stays disabled then. */
	function setCount(count: number | null) {
		draft.count = count;
		draft.identifiers = null;
		editNumbers = false;
	}

	function openNumbers() {
		numbersAuto = draft.identifiers === null;
		draft.identifiers = [...plan.identifiers];
		editNumbers = true;
	}
</script>

<!-- One form, so the keyboard's Enter/Go moves on like the button. -->
<form
	class="space-y-4 pb-24"
	onsubmit={(e) => {
		e.preventDefault();
		void next();
	}}
>
	<div class="flex h-9 items-center gap-2">
		{#if step !== 'name'}
			<Button variant="ghost" size="icon" onclick={back} aria-label="Zurück"
				><ArrowLeftIcon /></Button
			>
		{/if}
		<div class="flex flex-1 gap-1" aria-hidden="true">
			{#each steps as s (s)}
				<span
					class={[
						'h-1 flex-1 rounded-full',
						steps.indexOf(s) <= steps.indexOf(step) ? 'bg-primary' : 'bg-muted'
					]}
				></span>
			{/each}
		</div>
	</div>

	{#if step === 'name'}
		<QuickHere {session} {locations} phone />
		<h2 class="text-xl font-semibold">Was liegt hier?</h2>
		<Input
			bind:ref={nameInput}
			bind:value={() => draft.name, rename}
			placeholder="Name"
			maxlength={255}
			class="h-12 text-lg!"
			autocomplete="off"
			enterkeyhint="next"
			aria-label="Name"
		/>
		<p
			class={[
				'h-5 truncate text-sm',
				plan.problem ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
			]}
		>
			{plan.problem || (existing ? 'Gibt es schon, wird ergänzt.' : '')}
		</p>
		{#if similar.length}
			<ul class="divide-y rounded-lg border">
				{#each similar as suggestion (suggestion.variant.id)}
					<li>
						<button
							type="button"
							class="flex w-full items-center gap-2 px-3 py-3 text-left"
							onclick={() => {
								rename(suggestion.label);
								void next();
							}}
						>
							{#if suggestion.material.trackingType === 'BULK'}
								<LayersIcon class="size-4 shrink-0 text-muted-foreground" />
							{:else}
								<HashIcon class="size-4 shrink-0 text-muted-foreground" />
							{/if}
							<span class="flex-1">{suggestion.label}</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
		<QuickHistory {session} {onedit} />
	{:else if step === 'kind'}
		<h2 class="text-xl font-semibold">{draft.name.trim()}</h2>
		<div class="grid gap-3">
			<button
				type="button"
				class={[
					'flex gap-3 rounded-xl border p-4 text-left',
					kindChosen && draft.kind === 'BULK' && 'border-primary'
				]}
				onclick={() => chooseKind('BULK')}
			>
				<LayersIcon class="mt-0.5 size-6 shrink-0 text-muted-foreground" />
				<span>
					<span class="block text-lg font-medium">Menge</span>
					<span class="block text-sm text-muted-foreground">
						Nur zählen, alle gleich, z. B. Heringe, Töpfe
					</span>
				</span>
			</button>
			<button
				type="button"
				class={[
					'flex gap-3 rounded-xl border p-4 text-left',
					kindChosen && draft.kind === 'INDIVIDUAL' && 'border-primary'
				]}
				onclick={() => chooseKind('INDIVIDUAL')}
			>
				<HashIcon class="mt-0.5 size-6 shrink-0 text-muted-foreground" />
				<span>
					<span class="block text-lg font-medium">Einzeln</span>
					<span class="block text-sm text-muted-foreground">
						Jedes Stück nummeriert, mit eigenem Zustand und eigenen Aufgaben, z. B. Zelte, Gaskocher
					</span>
				</span>
			</button>
		</div>
	{:else if step === 'count'}
		<h2 class="text-xl font-semibold">Wie viele {draft.name.trim()}?</h2>
		{#if !editNumbers}
			<div class="flex items-center justify-center gap-4">
				<button
					type="button"
					class="flex size-14 items-center justify-center rounded-full border bg-muted/40 active:bg-muted"
					aria-label="Eins weniger"
					onclick={() => setCount(Math.max(1, (draft.count ?? 1) - 1))}><MinusIcon /></button
				>
				<Input
					type="number"
					inputmode="numeric"
					min="1"
					value={draft.count}
					oninput={(e) => setCount(Number(e.currentTarget.value) || null)}
					enterkeyhint={isLast ? 'done' : 'next'}
					class="h-16 w-28 text-center text-4xl! font-semibold tabular-nums"
					aria-label="Anzahl"
				/>
				<button
					type="button"
					class="flex size-14 items-center justify-center rounded-full border bg-muted/40 active:bg-muted"
					aria-label="Eins mehr"
					onclick={() => setCount((draft.count ?? 0) + 1)}><PlusIcon /></button
				>
			</div>
		{/if}
		{#if plan.kind === 'INDIVIDUAL'}
			{#if editNumbers && draft.identifiers}
				<NumberGrid
					bind:identifiers={draft.identifiers}
					taken={plan.taken}
					auto={numbersAuto}
					phone
				/>
			{:else}
				<div class="flex items-center justify-center gap-2 text-sm">
					<span class="font-mono">{compactList(plan.identifiers)}</span>
					<button type="button" class="text-primary" onclick={openNumbers}>andere Nummern</button>
				</div>
			{/if}
		{/if}
		<QuickStatus {plan} name={draft.name} center />
	{:else}
		<h2 class="text-xl font-semibold">Kategorie</h2>
		<div class="flex flex-wrap gap-2">
			{#each categoryChips as category (category)}
				<button
					type="button"
					class={[
						'rounded-full border px-4 py-2',
						category === draft.category ? 'border-primary bg-primary/10 font-medium' : 'bg-muted/40'
					]}
					onclick={() => (draft.category = draft.category === category ? '' : category)}
					>{category}</button
				>
			{/each}
		</div>
		<Input
			bind:value={draft.category}
			placeholder="Andere Kategorie"
			enterkeyhint="done"
			maxlength={100}
			class="h-11 text-base!"
			aria-label="Kategorie"
		/>
	{/if}

	{#if step !== 'kind'}
		<!-- Always in the same place, above the bottom navigation (which hides from `sm` on). -->
		<div
			class="fixed inset-x-0 bottom-16 z-40 border-t bg-background/95 p-3 backdrop-blur sm:bottom-0"
		>
			<Button type="submit" class="h-12 w-full text-base" disabled={!canGo || session.saving}>
				{isLast ? 'Speichern' : 'Weiter'}
			</Button>
		</div>
	{/if}
</form>
