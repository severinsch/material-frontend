<script lang="ts">
	import BedDoubleIcon from '@lucide/svelte/icons/bed-double';
	import { sleepingLabel } from '#lib/kits/packing.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';

	/**
	 * A compact badge for a tent line of the packing list: a bed while all its [quantity] tents are for sleeping,
	 * "2/3" if not all, opening the choices.
	 */
	let {
		quantity,
		notSleeping,
		label,
		onchange
	}: {
		quantity: number;
		notSleeping: number;
		/** The line's label, for screen readers. */
		label: string;
		onchange: (notSleeping: number) => void;
	} = $props();

	const sleeping = $derived(quantity - notSleeping);
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="sm"
				class={[
					'h-8 gap-1 px-2 tabular-nums',
					sleeping < quantity ? 'text-foreground' : 'text-muted-foreground'
				]}
				aria-label="Zum Schlafen bei {label}: {sleepingLabel(quantity, notSleeping)}"
				title={sleepingLabel(quantity, notSleeping)}
			>
				<BedDoubleIcon />{sleeping < quantity ? `${sleeping}/${quantity}` : ''}
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="w-auto">
		<DropdownMenu.RadioGroup
			value={String(notSleeping)}
			onValueChange={(value) => onchange(Number(value))}
		>
			{#each { length: quantity + 1 }, n (n)}
				<DropdownMenu.RadioItem value={String(n)}
					>{sleepingLabel(quantity, n)}</DropdownMenu.RadioItem
				>
			{/each}
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>
