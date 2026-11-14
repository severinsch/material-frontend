<!-- Picks the materials and items a task is about (several); materials are followed by their items. -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import CheckIcon from '@lucide/svelte/icons/check';
	import PackageIcon from '@lucide/svelte/icons/package';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { computeCommandScore } from 'bits-ui';
	import { itemNameOf } from '#lib/format.js';
	import { isRetired } from '#lib/items.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';
	import { linkNames } from '#lib/tasks.js';
	import { getTaskData } from './context.svelte.js';

	let {
		materialIds = $bindable(),
		itemIds = $bindable(),
		id,
		trigger
	}: {
		materialIds: string[];
		itemIds: string[];
		id?: string;
		/** Replaces the default chips and "add" button, e.g. by a property button of the task form. */
		trigger?: Snippet<[Record<string, unknown>]>;
	} = $props();

	const data = getTaskData();
	let open = $state(false);
	let search = $state('');

	/**
	 * Materials in use with their items that aren't retired; what is linked already stays listed, so it can be
	 * removed.
	 */
	const entries = $derived(
		data.materials
			.filter((m) => !m.archivedAt || materialIds.includes(m.id))
			.toSorted((a, b) => a.name.localeCompare(b.name, 'de'))
			.flatMap((material) => {
				const items = data.items
					.filter(
						(item) =>
							item.materialId === material.id && (!isRetired(item) || itemIds.includes(item.id))
					)
					.map((item) => ({
						key: `i:${item.id}`,
						id: item.id,
						kind: 'item' as const,
						name: itemNameOf(data.targets.variants, item),
						indented: true
					}))
					.toSorted((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true }));
				return [
					{
						key: `m:${material.id}`,
						id: material.id,
						kind: 'material' as const,
						name: material.name,
						indented: false
					},
					...items
				];
			})
	);

	const selected = (entry: (typeof entries)[number]) =>
		entry.kind === 'material' ? materialIds.includes(entry.id) : itemIds.includes(entry.id);

	function toggle(entry: { kind: 'material' | 'item'; id: string }) {
		if (entry.kind === 'material') {
			materialIds = materialIds.includes(entry.id)
				? materialIds.filter((m) => m !== entry.id)
				: [...materialIds, entry.id];
		} else {
			itemIds = itemIds.includes(entry.id)
				? itemIds.filter((i) => i !== entry.id)
				: [...itemIds, entry.id];
		}
	}

	const chips = $derived([
		...materialIds.map((m) => ({ kind: 'material' as const, id: m })),
		...itemIds.map((i) => ({ kind: 'item' as const, id: i }))
	]);
	const chipName = (chip: (typeof chips)[number]) =>
		linkNames(
			chip.kind === 'material'
				? { materialIds: [chip.id], itemIds: [] }
				: { materialIds: [], itemIds: [chip.id] },
			data.targets
		)[0];
</script>

<div class="flex flex-wrap items-center gap-1.5">
	{#if !trigger}
		{#each chips as chip (chip.kind + chip.id)}
			<span
				class="inline-flex items-center gap-1 rounded-md border bg-muted/40 py-0.5 pr-1 pl-2 text-sm"
			>
				<PackageIcon class="size-3.5 text-muted-foreground" />{chipName(chip)}
				<button
					type="button"
					class="rounded p-0.5 text-muted-foreground hover:text-foreground"
					aria-label="{chipName(chip)} entfernen"
					onclick={() => toggle(chip)}
				>
					<XIcon class="size-3.5" />
				</button>
			</span>
		{/each}
	{/if}
	<Popover.Root bind:open onOpenChange={() => (search = '')}>
		<Popover.Trigger>
			{#snippet child({ props })}
				{#if trigger}
					{@render trigger(props)}
				{:else}
					<Button
						{...props}
						{id}
						type="button"
						variant="outline"
						size="sm"
						class="h-7 font-normal text-muted-foreground"
					>
						<PlusIcon />{chips.length ? 'Weiteres' : 'Material oder Gegenstand'}
					</Button>
				{/if}
			{/snippet}
		</Popover.Trigger>
		<Popover.Content class="w-72 p-0" align="start">
			<Command.Root filter={(_, s, keywords) => computeCommandScore(keywords?.[0] ?? '', s)}>
				<Command.Input placeholder="Material oder „Kohte K03“ suchen…" bind:value={search} />
				<Command.List>
					<Command.Empty>Nichts gefunden.</Command.Empty>
					<Command.Group>
						{#each entries as entry (entry.key)}
							<Command.Item
								value={entry.key}
								keywords={[entry.name]}
								class={entry.indented && !search ? 'pl-6' : ''}
								onSelect={() => toggle(entry)}
							>
								<CheckIcon class={selected(entry) ? '' : 'opacity-0'} />
								{entry.name}
							</Command.Item>
						{/each}
					</Command.Group>
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</div>
