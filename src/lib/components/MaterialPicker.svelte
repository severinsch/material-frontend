<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import { computeCommandScore } from 'bits-ui';
	import { tick } from 'svelte';
	import type { Material } from '#lib/api/index.js';
	import { variantName } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Command from '#lib/components/ui/command/index.js';
	import * as Popover from '#lib/components/ui/popover/index.js';

	let {
		materialId = $bindable(),
		variantId = $bindable(),
		materials,
		id,
		invalid = false,
		'aria-label': ariaLabel,
		'aria-describedby': ariaDescribedBy
	}: {
		/** The selected material id, or '' for none. */
		materialId: string;
		/** The selected variant, or null for any variant of the material. */
		variantId: string | null;
		materials: Material[];
		id?: string;
		invalid?: boolean;
		/** Followed by the selected material, since the label replaces the button's text. */
		'aria-label'?: string;
		'aria-describedby'?: string;
	} = $props();

	let open = $state(false);
	let trigger = $state<HTMLElement | null>(null);
	/** While searching, variants are listed by their full name, since their material may not be among the hits. */
	let search = $state('');

	/**
	 * A material with several variants is offered as "any variant" followed by its variants; others once, as the
	 * material. The values are unique keys; the search filters on the names, given as keywords.
	 */
	const entries = $derived(
		materials
			.toSorted((a, b) => a.name.localeCompare(b.name))
			.flatMap((material) =>
				material.variants.length > 1
					? [
							{
								key: material.id,
								materialId: material.id,
								variantId: null,
								name: `${material.name} (beliebige Variante)`,
								label: `${material.name} (beliebige Variante)`,
								indented: false
							},
							...material.variants.map((variant) => ({
								key: `${material.id}/${variant.id}`,
								materialId: material.id,
								variantId: variant.id,
								name: variantName(material, variant),
								label: variant.name ?? '',
								indented: true
							}))
						]
					: [
							{
								key: material.id,
								materialId: material.id,
								variantId: null,
								name: material.name,
								label: material.name,
								indented: false
							}
						]
			)
	);
	/**
	 * The selection's name. An option for a specific variant of a material that has only this variant left is shown
	 * as the material, like "any variant", which means the same then.
	 */
	const selectedName = $derived.by(() => {
		const material = materials.find((m) => m.id === materialId);
		if (!material) return undefined;
		const variant = material.variants.find((v) => v.id === variantId);
		if (variant) return variantName(material, variant);
		return material.variants.length > 1 ? `${material.name} (beliebige Variante)` : material.name;
	});

	function isSelected(entry: (typeof entries)[number]) {
		const material = materials.find((m) => m.id === entry.materialId);
		return (
			entry.materialId === materialId &&
			(entry.variantId === variantId || (material?.variants.length ?? 0) <= 1)
		);
	}

	async function choose(entry: (typeof entries)[number]) {
		materialId = entry.materialId;
		variantId = entry.variantId;
		open = false;
		await tick();
		trigger?.focus();
	}
</script>

<Popover.Root bind:open onOpenChange={() => (search = '')}>
	<Popover.Trigger bind:ref={trigger}>
		{#snippet child({ props })}
			<Button
				{...props}
				{id}
				variant="outline"
				role="combobox"
				aria-expanded={open}
				aria-invalid={invalid || undefined}
				aria-label={ariaLabel && `${ariaLabel}: ${selectedName ?? 'kein Material gewählt'}`}
				aria-describedby={ariaDescribedBy}
				class="w-full justify-between font-normal"
			>
				<span class={['truncate', !selectedName && 'text-muted-foreground']}>
					{selectedName ?? 'Material wählen…'}
				</span>
				<ChevronsUpDownIcon class="opacity-50" />
			</Button>
		{/snippet}
	</Popover.Trigger>
	<Popover.Content class="w-(--bits-popover-anchor-width) min-w-60 p-0" align="start">
		<Command.Root
			filter={(_, search, keywords) => computeCommandScore(keywords?.[0] ?? '', search)}
		>
			<Command.Input placeholder="Material suchen…" bind:value={search} />
			<Command.List>
				<Command.Empty>Kein Material gefunden.</Command.Empty>
				<Command.Group>
					{#each entries as entry (entry.key)}
						<!-- Variants show their own name, but are found and announced by the full one, e.g. "Seil 15". -->
						<Command.Item
							value={entry.key}
							keywords={[entry.name]}
							aria-label={entry.name}
							class={entry.indented && !search ? 'pl-6' : ''}
							onSelect={() => choose(entry)}
						>
							<!-- Not text-transparent: the highlighted item colours its icons. -->
							<CheckIcon class={isSelected(entry) ? '' : 'opacity-0'} />
							{search ? entry.name : entry.label}
						</Command.Item>
					{/each}
				</Command.Group>
			</Command.List>
		</Command.Root>
	</Popover.Content>
</Popover.Root>
