<!--
	What was entered on this device since the page was opened: the last entry in one quiet line, the rest on request.
	Each entry can be edited (the material dialog) or undone.
-->
<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Undo2Icon from '@lucide/svelte/icons/undo-2';
	import type { Material, Variant } from '#lib/api/index.js';
	import { compactList } from '#lib/quick-entry.js';
	import type { HistoryEntry, QuickSession } from './session.svelte.js';

	let { session, onedit }: { session: QuickSession; onedit: (material: Material) => void } =
		$props();

	let open = $state(false);
	const last = $derived(session.history[0]);

	function amount({ result, identifiers }: HistoryEntry): string {
		if (result.itemIds.length) return compactList(identifiers);
		if (result.created) return String(result.count);
		const variant = (result.material.variants as Variant[]).find((v) => v.id === result.variantId);
		return `+${result.count} → ${variant?.availableCount ?? '?'}`;
	}

	function edit(entry: HistoryEntry) {
		// The current state if the page data has it, e.g. after later entries.
		onedit(
			session.materials.find((m) => m.id === entry.result.material.id) ?? entry.result.material
		);
	}
</script>

{#if last}
	<div class="text-xs text-muted-foreground">
		<div class="flex h-7 items-center gap-3">
			<span class="min-w-0 truncate">
				Zuletzt: <span class="text-foreground">{last.label}</span>
				<span class="tabular-nums">{amount(last)}</span>
			</span>
			<button
				type="button"
				class="flex shrink-0 items-center gap-1 hover:text-foreground pointer-coarse:p-2"
				onclick={() => session.undo(last)}><Undo2Icon class="size-3.5" />rückgängig</button
			>
			<button
				type="button"
				class="ml-auto flex shrink-0 items-center gap-0.5 hover:text-foreground"
				aria-expanded={open}
				onclick={() => (open = !open)}
			>
				Verlauf ({session.history.length})
				<ChevronDownIcon class={['size-3.5 transition-transform', open && 'rotate-180']} />
			</button>
		</div>
		{#if open}
			<ul class="mt-1 divide-y rounded-lg border">
				{#each session.history as entry (entry.key)}
					<li class="flex items-center gap-3 px-3 py-1.5">
						<span class="min-w-0 flex-1 truncate">
							<span class="text-foreground">{entry.label}</span>
							{#if !entry.result.created}· ergänzt{/if}
						</span>
						<span class="shrink-0 font-mono tabular-nums">{amount(entry)}</span>
						<button
							type="button"
							class="shrink-0 hover:text-foreground pointer-coarse:p-2"
							aria-label="{entry.label} bearbeiten"
							onclick={() => edit(entry)}><PencilIcon class="size-3.5" /></button
						>
						<button
							type="button"
							class="shrink-0 hover:text-foreground pointer-coarse:p-2"
							aria-label="{entry.label} rückgängig machen"
							onclick={() => session.undo(entry)}><Undo2Icon class="size-3.5" /></button
						>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}
