<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import PlusCircleIcon from '@lucide/svelte/icons/circle-plus';
	import type { SvelteSet } from 'svelte/reactivity';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { Separator } from '#lib/components/ui/separator/index.js';

	let { counts, selected }: { counts: [string, number][]; selected: SvelteSet<string> } = $props();

	const names = $derived([...selected].map((category) => category || 'Ohne Kategorie'));

	function toggle(category: string) {
		if (!selected.delete(category)) selected.add(category);
	}
</script>

<Popover.Root>
	<Popover.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="outline" class="justify-start border-dashed">
				<PlusCircleIcon />
				Kategorie
				{#if names.length > 0}
					<Separator orientation="vertical" class="mx-1 h-4!" />
					{#if names.length > 2}
						<Badge variant="secondary" class="rounded-sm px-1 font-normal"
							>{names.length} ausgewählt</Badge
						>
					{:else}
						{#each names as name (name)}
							<Badge variant="secondary" class="rounded-sm px-1 font-normal">{name}</Badge>
						{/each}
					{/if}
				{/if}
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-60 p-0" align="start">
		<Command.Root>
			<Command.Input placeholder="Kategorie suchen…" />
			<Command.List>
				<Command.Empty>Keine Kategorie gefunden.</Command.Empty>
				<Command.Group>
					{#each counts as [category, count] (category)}
						{@const active = selected.has(category)}
						<Command.Item
							value={category || 'Ohne Kategorie'}
							aria-selected={active}
							onSelect={() => toggle(category)}
						>
							<span
								class={[
									'flex size-4 items-center justify-center rounded-sm border border-primary',
									active ? 'bg-primary text-primary-foreground' : 'opacity-50 [&_svg]:invisible'
								]}
							>
								<CheckIcon class="size-3.5 text-current!" />
							</span>
							{category || 'Ohne Kategorie'}
							<!-- A shortcut, so the item leaves out its own check mark. -->
							<Command.Shortcut class="tracking-normal tabular-nums">{count}</Command.Shortcut>
						</Command.Item>
					{/each}
				</Command.Group>
				{#if selected.size > 0}
					<Command.Separator />
					<Command.Group>
						<Command.Item class="justify-center text-center" onSelect={() => selected.clear()}>
							Filter zurücksetzen
						</Command.Item>
					</Command.Group>
				{/if}
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
