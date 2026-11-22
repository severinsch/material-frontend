<!--
	Suggestions under a field (names of materials, categories). Keys go through `keydown` from the field: ↓/↑
	highlight, Enter or Tab pick only a highlighted one (so Enter still saves what was typed), Escape closes.
-->
<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';

	let {
		items,
		onpick,
		item,
		class: className = 'w-72'
	}: {
		items: T[];
		onpick: (item: T) => void;
		item: Snippet<[T]>;
		class?: string;
	} = $props();

	let active = $state(-1);
	let dismissed = $state(false);

	$effect(() => {
		// New suggestions: nothing highlighted, shown again.
		void items;
		active = -1;
		dismissed = false;
	});

	const shown = $derived(items.length > 0 && !dismissed);

	/** Handles [event] from the field's keydown; true if it was used here. */
	export function keydown(event: KeyboardEvent): boolean {
		if (!shown) return false;
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			// Cycles through the items and "none" (-1).
			const size = items.length + 1;
			active = ((active + 1 + (event.key === 'ArrowDown' ? 1 : -1) + size) % size) - 1;
		} else if ((event.key === 'Enter' || event.key === 'Tab') && active >= 0) {
			onpick(items[active]);
		} else if (event.key === 'Escape') {
			dismissed = true;
		} else {
			return false;
		}
		event.preventDefault();
		return true;
	}
</script>

{#if shown}
	<ul
		class={[
			'absolute top-full left-0 z-30 mt-1 overflow-hidden rounded-lg border bg-popover py-1 text-sm shadow-md',
			className
		]}
		role="listbox"
	>
		{#each items as entry, i (i)}
			<li role="option" aria-selected={i === active}>
				<button
					type="button"
					tabindex="-1"
					class={[
						'flex w-full items-center gap-2 px-2.5 py-1.5 text-left',
						i === active ? 'bg-muted' : 'hover:bg-muted/60'
					]}
					onmousedown={(e) => {
						// Before the field's blur, so the field keeps the focus.
						e.preventDefault();
						onpick(entry);
					}}
				>
					{@render item(entry)}
				</button>
			</li>
		{/each}
	</ul>
{/if}
