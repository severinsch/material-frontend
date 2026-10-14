<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { tick } from 'svelte';
	import type { Material } from '#lib/api/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';

	let {
		value = $bindable(),
		materials,
		id,
		invalid = false,
		'aria-label': ariaLabel,
		'aria-describedby': ariaDescribedBy
	}: {
		/** The selected material id, or '' for none. */
		value: string;
		materials: Material[];
		id?: string;
		invalid?: boolean;
		/** Followed by the selected material, since the label replaces the button's text. */
		'aria-label'?: string;
		'aria-describedby'?: string;
	} = $props();

	let open = $state(false);
	let trigger = $state<HTMLElement | null>(null);

	const sorted = $derived(materials.toSorted((a, b) => a.name.localeCompare(b.name)));
	const selected = $derived(materials.find((material) => material.id === value));

	async function choose(materialId: string) {
		value = materialId;
		open = false;
		await tick();
		trigger?.focus();
	}
</script>

<Popover.Root bind:open>
	<Popover.Trigger bind:ref={trigger}>
		{#snippet child({ props })}
			<Button
				{...props}
				{id}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				aria-invalid={invalid || undefined}
				aria-label={ariaLabel && `${ariaLabel}: ${selected?.name ?? 'kein Material gewählt'}`}
				aria-describedby={ariaDescribedBy}
				class="w-full justify-between font-normal"
			>
				<span class={['truncate', !selected && 'text-muted-foreground']}>
					{selected?.name ?? 'Material wählen…'}
				</span>
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-(--bits-popover-anchor-width) min-w-60 p-0" align="start">
		<Command.Root>
			<Command.Input placeholder="Material suchen…" />
			<Command.List>
				<Command.Empty>Kein Material gefunden.</Command.Empty>
				<Command.Group>
					{#each sorted as material (material.id)}
						<!-- Names are unique, so they serve as the value the search filters on. -->
						<Command.Item value={material.name} onSelect={() => choose(material.id)}>
							<CheckIcon class={material.id === value ? '' : 'text-transparent'} />
							{material.name}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
