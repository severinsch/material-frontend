<!-- The plain alternative to the input line on desktop: one field per thing, nothing interpreted. Enter saves. -->
<script lang="ts">
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import { onMount } from 'svelte';
	import type { CategoryUse } from '#lib/categories.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { similarMaterials, type Suggestion } from '#lib/quick-entry.js';
	import CategoryField from './CategoryField.svelte';
	import KindToggle from './KindToggle.svelte';
	import NumbersButton from './NumbersButton.svelte';
	import QuickStatus from './QuickStatus.svelte';
	import SuggestionList from './SuggestionList.svelte';
	import { emptyDraft, type Draft, type QuickSession } from './session.svelte.js';

	let { session, categories }: { session: QuickSession; categories: CategoryUse[] } = $props();

	// Starts with the category carried over from the last new material.
	let draft: Draft = $state(fresh());
	let nameInput: HTMLInputElement | null = $state(null);
	let list: ReturnType<typeof SuggestionList<Suggestion>> | null = $state(null);

	const plan = $derived(session.plan(draft));
	const existing = $derived(plan.match.kind === 'existing' ? plan.match : null);
	const suggestions = $derived(similarMaterials(session.materials, draft.name));

	function fresh() {
		return emptyDraft(session.category);
	}

	onMount(() => {
		session.focusInput = () => nameInput?.focus();
	});

	/** Numbers picked for one material don't carry over to another name. */
	function rename(name: string) {
		draft.name = name;
		draft.identifiers = null;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		await session.save(draft, () => (draft = fresh()));
	}
</script>

<form onsubmit={submit} class="grid gap-2">
	<div class="flex items-end gap-2">
		<label class="relative grid flex-1 gap-1">
			<span class="text-xs text-muted-foreground">Name</span>
			<Input
				bind:ref={nameInput}
				bind:value={() => draft.name, rename}
				onkeydown={(e) => list?.keydown(e)}
				placeholder="z. B. Gaskocher"
				maxlength={255}
				class="h-11 text-base!"
				autocomplete="off"
				autofocus
			/>
			<SuggestionList
				bind:this={list}
				items={suggestions}
				onpick={(s) => {
					rename(s.label);
					nameInput?.focus();
				}}
			>
				{#snippet item(suggestion)}
					<span class="flex-1 truncate">{suggestion.label}</span>
				{/snippet}
			</SuggestionList>
		</label>
		<label class="grid w-24 gap-1">
			<span class="text-xs text-muted-foreground">Anzahl</span>
			<Input
				type="number"
				min="1"
				bind:value={draft.count}
				oninput={() => (draft.identifiers = null)}
				placeholder="0"
				class="h-11 text-base! tabular-nums"
			/>
		</label>
		<div class="flex h-11 items-center">
			{#if existing}
				<KindToggle kind={existing.material.trackingType} locked="Wie bisher" />
			{:else}
				<KindToggle bind:kind={draft.kind} onchange={() => nameInput?.focus()} />
			{/if}
		</div>
		<!-- Keeps its space while hidden, so the row doesn't jump. -->
		<div
			class={[
				'flex h-11 w-36 items-center',
				!(plan.kind === 'INDIVIDUAL' && draft.name.trim()) && 'invisible'
			]}
		>
			<NumbersButton
				identifiers={plan.identifiers}
				taken={plan.taken}
				auto={draft.identifiers === null}
				onchange={(ids) => {
					draft.identifiers = ids;
					draft.count = ids.length;
				}}
				returnFocus={() => nameInput?.focus()}
			/>
		</div>
		<CategoryField
			bind:value={draft.category}
			{categories}
			fixed={existing ? (existing.material.category ?? '') : null}
		/>
		<Button type="submit" class="h-11" disabled={plan.problem !== null || session.saving}>
			Speichern <CornerDownLeftIcon class="opacity-60" />
		</Button>
	</div>
	<QuickStatus {plan} name={draft.name} />
</form>
