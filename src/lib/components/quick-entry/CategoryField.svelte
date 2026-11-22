<!--
	The category of a new material, next to the save button so it's seen on every save. Existing categories are
	suggested while typing (as in the material dialog), to avoid near-duplicates like "Zelt" and "Zelte".
-->
<script lang="ts">
	import type { CategoryUse } from '#lib/categories.js';
	import { suggestCategories } from '#lib/categories.js';
	import SuggestionList from './SuggestionList.svelte';

	let {
		value = $bindable(),
		categories,
		/** The existing material's category, shown instead of the field. */
		fixed = null
	}: { value: string; categories: CategoryUse[]; fixed?: string | null } = $props();

	let focused = $state(false);
	let list: ReturnType<typeof SuggestionList<string>> | null = $state(null);
	const suggestions = $derived(focused ? suggestCategories(categories, value, 8) : []);
</script>

<label
	class={[
		'relative flex h-11 w-48 shrink-0 flex-col justify-center rounded-lg border px-2.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
		fixed !== null && 'bg-muted/50'
	]}
>
	<span class="text-[0.65rem] leading-none text-muted-foreground">Kategorie</span>
	{#if fixed !== null}
		<span class="truncate text-sm text-muted-foreground">{fixed || 'keine'}</span>
	{:else}
		<input
			bind:value
			onfocus={() => (focused = true)}
			onblur={() => (focused = false)}
			onkeydown={(e) => list?.keydown(e)}
			placeholder="keine"
			maxlength={100}
			autocomplete="off"
			class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
		/>
		<SuggestionList
			bind:this={list}
			items={suggestions}
			onpick={(category) => (value = category)}
			class="w-48"
		>
			{#snippet item(category)}{category}{/snippet}
		</SuggestionList>
	{/if}
</label>
