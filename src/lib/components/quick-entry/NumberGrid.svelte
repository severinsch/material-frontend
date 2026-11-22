<!--
	Picking the labels of new items when they aren't simply the next ones (Kohtenplanen 1–5 and 7–9, because 6 was
	lost long ago): tap them in a grid, existing ones are crossed out; anything else goes into the field: "Rot", "K45 01" or lists like
	"K01-K12, K14".
-->
<script lang="ts">
	import XIcon from '@lucide/svelte/icons/x';
	import { Input } from '#lib/components/ui/input/index.js';
	import { parseList } from '#lib/quick-entry.js';

	let {
		identifiers = $bindable(),
		taken,
		auto = false,
		phone = false
	}: {
		identifiers: string[];
		/** The variant's existing labels: shown, but not selectable. */
		taken: string[];
		/**
		 * Whether [identifiers] start as the automatic numbering (1, 2, 3 …): then labels typed into the field replace
		 * them rather than adding to them, e.g. "K01-K12" for tents labelled like that.
		 */
		auto?: boolean;
		phone?: boolean;
	} = $props();

	let untouched = $state(true);

	const numbered = /^(.*?)(\d+)$/;

	// Prefix and digit width from the existing or chosen labels ("K01" → "K", 2 digits).
	const template = $derived(
		numbered.exec(
			taken.find((t) => numbered.test(t)) ?? identifiers.find((i) => numbered.test(i)) ?? '1'
		)!
	);
	const prefix = $derived(template[1]);
	const width = $derived(template[2].length);
	const inGrid = (label: string) => {
		const match = numbered.exec(label);
		return !!match && match[1] === prefix && (width === 1 || match[2].length === width);
	};
	const highest = $derived(
		Math.max(
			0,
			...[...taken, ...identifiers].filter(inGrid).map((l) => Number(numbered.exec(l)![2]))
		)
	);
	let extra = $state(0);
	const size = $derived(Math.max(10, Math.ceil((highest + 1) / 10) * 10) + extra);
	const cells = $derived(
		Array.from({ length: size }, (_, i) => prefix + String(i + 1).padStart(width, '0'))
	);
	/** Chosen labels outside the grid, like "Rot". */
	const others = $derived(identifiers.filter((label) => !cells.includes(label)));

	function toggle(label: string) {
		untouched = false;
		const next = identifiers.includes(label)
			? identifiers.filter((l) => l !== label)
			: [...identifiers, label];
		// Grid order first, then the others in the order they were added.
		identifiers = [
			...cells.filter((c) => next.includes(c)),
			...next.filter((l) => !cells.includes(l))
		];
	}

	let input = $state('');
	const unreadable = $derived(input.trim() !== '' && parseList(input) === null);

	function add() {
		const labels = parseList(input);
		if (!labels) return;
		const base = auto && untouched ? [] : identifiers;
		const fresh = labels.filter((label) => !base.includes(label) && !taken.includes(label));
		identifiers = [...base, ...fresh];
		untouched = false;
		input = '';
	}
</script>

<div class="grid gap-2">
	<div class={['grid gap-1', phone ? 'grid-cols-5' : 'grid-cols-10']}>
		{#each cells as label (label)}
			{@const isTaken = taken.includes(label)}
			{@const on = identifiers.includes(label)}
			<button
				type="button"
				disabled={isTaken}
				aria-pressed={on}
				onclick={() => toggle(label)}
				title={isTaken ? 'gibt es schon' : undefined}
				class={[
					'rounded-md border font-mono tabular-nums transition-colors',
					phone ? 'h-11 text-sm' : 'h-8 text-xs',
					isTaken && 'border-dashed text-muted-foreground/50 line-through',
					on && 'border-primary bg-primary text-primary-foreground',
					!isTaken && !on && 'hover:bg-muted'
				]}>{label}</button
			>
		{/each}
	</div>
	<div class="flex items-center gap-2">
		<Input
			bind:value={input}
			onkeydown={(e) => {
				if (e.key !== 'Enter') return;
				e.preventDefault();
				e.stopPropagation();
				add();
			}}
			onblur={add}
			placeholder="Andere, z. B. Rot oder K01-K12"
			aria-invalid={unreadable || undefined}
			title={unreadable ? 'Nicht lesbar, z. B. „K12-K10“' : undefined}
			class={['flex-1', phone ? 'h-11 text-base!' : 'h-8']}
			aria-label="Andere Bezeichnung hinzufügen"
		/>
		<button type="button" class="shrink-0 text-xs text-primary" onclick={() => (extra += 10)}>
			mehr Nummern
		</button>
	</div>
	{#if others.length}
		<div class="flex flex-wrap gap-1">
			{#each others as label (label)}
				<span
					class="inline-flex items-center gap-0.5 rounded-md border border-primary bg-primary/10 py-0.5 pr-0.5 pl-1.5 font-mono text-xs"
				>
					{label}
					<button
						type="button"
						class="rounded p-0.5 hover:bg-muted pointer-coarse:p-2"
						aria-label="{label} entfernen"
						onclick={() => (identifiers = identifiers.filter((l) => l !== label))}
						><XIcon class="size-3" /></button
					>
				</span>
			{/each}
		</div>
	{/if}
</div>
