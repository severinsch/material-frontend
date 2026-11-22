<!--
	The desktop input line: "40 Heringe", "5 Gaskocher einzeln", "Kohtenplane K09-K11" (rules in parseLine). Below it
	always the same slots show how the line is read, so nothing jumps while typing. Enter saves.
-->
<script lang="ts">
	import CornerDownLeftIcon from '@lucide/svelte/icons/corner-down-left';
	import HashIcon from '@lucide/svelte/icons/hash';
	import InfoIcon from '@lucide/svelte/icons/info';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import { onMount } from 'svelte';
	import type { CategoryUse } from '#lib/categories.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { countAtEnd, parseLine, similarMaterials, type Suggestion } from '#lib/quick-entry.js';
	import CategoryField from './CategoryField.svelte';
	import KindToggle from './KindToggle.svelte';
	import NumbersButton from './NumbersButton.svelte';
	import QuickStatus from './QuickStatus.svelte';
	import SuggestionList from './SuggestionList.svelte';
	import type { Draft, Kind, QuickSession } from './session.svelte.js';

	let { session, categories }: { session: QuickSession; categories: CategoryUse[] } = $props();

	let line = $state('');
	let kind: Kind = $state('BULK');
	// Carried over from the last new material.
	let category = $state(carriedCategory());
	let input: HTMLInputElement | null = $state(null);
	let list: ReturnType<typeof SuggestionList<Suggestion>> | null = $state(null);
	/**
	 * Labels picked in the grid. Kept beside the line rather than written into it, since labels like "K45 01" or
	 * "Großes Zelt" can't be typed in the line; editing the line drops them.
	 */
	let picked: string[] | null = $state(null);

	const parsed = $derived(parseLine(line));
	const draft: Draft = $derived({
		name: parsed.name,
		count: parsed.count,
		kind: picked || parsed.individual ? 'INDIVIDUAL' : kind,
		identifiers: picked ?? parsed.identifiers,
		start: picked ? null : parsed.start,
		category
	});
	const plan = $derived(session.plan(draft));
	const existing = $derived(plan.match.kind === 'existing' ? plan.match : null);
	const problem = $derived(parsed.problem ?? plan.problem);
	const locked = $derived(
		existing
			? `${existing.material.name} wird ${existing.material.trackingType === 'BULK' ? 'nach Menge' : 'einzeln'} erfasst`
			: picked
				? 'Nummern gewählt'
				: parsed.individual
					? 'Steht so in der Zeile'
					: null
	);
	const suggestions = $derived(similarMaterials(session.materials, parsed.name));

	function carriedCategory() {
		return session.category;
	}

	function pick(suggestion: Suggestion) {
		line = line.slice(0, parsed.nameStart) + suggestion.label + line.slice(parsed.nameEnd);
		input?.focus();
	}

	onMount(() => {
		session.focusInput = () => input?.focus();
	});

	function edit(value: string) {
		line = value;
		picked = null;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (problem !== null) return;
		await session.save(draft, () => {
			line = '';
			picked = null;
			kind = 'BULK';
			category = carriedCategory();
		});
	}
</script>

<form onsubmit={submit} class="grid gap-2">
	<div class="flex gap-2">
		<div class="relative flex-1">
			<Input
				bind:ref={input}
				bind:value={() => line, edit}
				onkeydown={(e) => list?.keydown(e)}
				placeholder="z. B. 40 Heringe"
				class="h-11 pr-10 text-base!"
				aria-label="Anzahl und Name"
				autocomplete="off"
				autofocus
			/>
			<Popover.Root>
				<Popover.Trigger
					class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:text-foreground"
					aria-label="Wie die Zeile gelesen wird"
				>
					<InfoIcon class="size-4" />
				</Popover.Trigger>
				<Popover.Content align="end" class="w-80 text-sm">
					<ul class="grid gap-1.5">
						<li><code>40 Heringe</code>: Anzahl vorn</li>
						<li><code>5 Gaskocher einzeln</code>: einzeln, nummeriert 1–5</li>
						<li><code>4 Laterne ab 10</code>: nummeriert ab 10</li>
						<li>
							<code>Kohtenplane K09-K11</code>, <code>… #7</code>, <code>… #1-5, 8</code>,
							<code>… #1-3, Rot</code>: genau diese Nummern
						</li>
						<li class="text-muted-foreground">
							Andere Zahlen am Ende gehören zum Namen (<code>Seil 15 m</code>,
							<code>Spanngurt 2,5</code>). ↓ wählt einen Vorschlag.
						</li>
					</ul>
				</Popover.Content>
			</Popover.Root>
			<SuggestionList bind:this={list} items={suggestions} onpick={pick}>
				{#snippet item(suggestion)}
					{#if suggestion.material.trackingType === 'BULK'}
						<LayersIcon class="size-3.5 shrink-0 text-muted-foreground" />
					{:else}
						<HashIcon class="size-3.5 shrink-0 text-muted-foreground" />
					{/if}
					<span class="flex-1 truncate">{suggestion.label}</span>
					<span class="text-xs text-muted-foreground tabular-nums">
						{suggestion.variant.availableCount}
					</span>
				{/snippet}
			</SuggestionList>
		</div>
		<CategoryField
			bind:value={category}
			{categories}
			fixed={existing ? (existing.material.category ?? '') : null}
		/>
		<Button type="submit" class="h-11" disabled={problem !== null || session.saving}>
			Speichern <CornerDownLeftIcon class="opacity-60" />
		</Button>
	</div>

	<div class="flex h-7 items-center gap-2 text-sm">
		<span
			class={[
				'flex h-7 min-w-12 items-center justify-center rounded-md border px-2 tabular-nums',
				!parsed.name && 'border-dashed text-muted-foreground'
			]}>{parsed.name ? `${plan.count || parsed.count}×` : 'Anzahl'}</span
		>
		<span
			class={[
				'flex h-7 max-w-80 min-w-24 items-center truncate rounded-md border px-2',
				!parsed.name && 'border-dashed text-muted-foreground'
			]}>{parsed.name || 'Name'}</span
		>
		{#if locked}
			<KindToggle kind={plan.kind} {locked} />
		{:else}
			<!-- Back to the line after a click, so Enter saves rather than clicking the toggle again. -->
			<KindToggle bind:kind onchange={() => input?.focus()} />
		{/if}
		{#if plan.kind === 'INDIVIDUAL' && parsed.name}
			<NumbersButton
				identifiers={plan.identifiers}
				taken={plan.taken}
				auto={!picked && !parsed.identifiers}
				onchange={(identifiers) => (picked = identifiers)}
				returnFocus={() => input?.focus()}
			/>
		{/if}
	</div>

	<QuickStatus
		plan={problem === plan.problem ? plan : { ...plan, problem }}
		name={parsed.name}
		hint={countAtEnd(session.materials, parsed.name)}
	/>
</form>
