<!-- The labels of the new items as a chip; a click opens the grid in a popover. -->
<script lang="ts">
	import HashIcon from '@lucide/svelte/icons/hash';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { compactList } from '#lib/quick-entry.js';
	import NumberGrid from './NumberGrid.svelte';

	let {
		identifiers,
		taken,
		auto = false,
		onchange,
		returnFocus
	}: {
		identifiers: string[];
		taken: string[];
		/** [identifiers] are the automatic numbering, see `NumberGrid`. */
		auto?: boolean;
		onchange: (identifiers: string[]) => void;
		/** Where the focus goes after closing, instead of back to the chip. */
		returnFocus?: () => void;
	} = $props();

	let open = $state(false);
	let chosen: string[] = $state([]);

	function toggle(next: boolean) {
		if (next) chosen = [...identifiers];
		open = next;
	}
</script>

<Popover.Root {open} onOpenChange={toggle}>
	<Popover.Trigger>
		{#snippet child({ props })}
			<button
				{...props}
				type="button"
				class="flex h-7 max-w-56 items-center gap-1 rounded-md border px-2 font-mono text-xs hover:bg-muted"
				title="Nummern ändern"
			>
				<HashIcon class="size-3.5 shrink-0 text-muted-foreground" />
				<span class="truncate">{identifiers.length ? compactList(identifiers) : 'Nummern'}</span>
			</button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content
		align="start"
		class="w-[26rem]"
		onCloseAutoFocus={(event) => {
			if (!returnFocus) return;
			event.preventDefault();
			returnFocus();
		}}
	>
		<div class="grid gap-3">
			<p class="text-sm font-medium">Welche Nummern?</p>
			{#key open}
				<NumberGrid bind:identifiers={chosen} {taken} {auto} />
			{/key}
			<div class="flex justify-end gap-2">
				<Button variant="ghost" size="sm" onclick={() => (open = false)}>Abbrechen</Button>
				<Button
					size="sm"
					disabled={chosen.length === 0}
					onclick={() => {
						onchange(chosen);
						open = false;
					}}>Übernehmen</Button
				>
			</div>
		</div>
	</Popover.Content>
</Popover.Root>
