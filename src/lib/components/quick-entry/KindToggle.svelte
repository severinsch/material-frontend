<!-- Menge | Einzeln. Fixed (and dimmed) when the material or the input line decides. -->
<script lang="ts">
	import HashIcon from '@lucide/svelte/icons/hash';
	import LayersIcon from '@lucide/svelte/icons/layers';
	import type { Kind } from './session.svelte.js';

	let {
		kind = $bindable(),
		locked = null,
		size = 'md',
		onchange
	}: {
		kind: Kind;
		/** Why it can't be changed (a tooltip); null when it can. */
		locked?: string | null;
		size?: 'md' | 'lg';
		onchange?: () => void;
	} = $props();

	const options: { value: Kind; label: string; title: string }[] = [
		{
			value: 'BULK',
			label: 'Menge',
			title: 'Nur die Anzahl; die Stücke sind gleich (z. B. Heringe)'
		},
		{
			value: 'INDIVIDUAL',
			label: 'Einzeln',
			title:
				'Jedes Stück nummeriert, mit eigenem Zustand und eigenen Aufgaben (z. B. Zelte, Kocher)'
		}
	];
</script>

<div
	class={[
		'inline-flex shrink-0 rounded-lg bg-muted p-0.5',
		size === 'lg' && 'w-full',
		locked && 'opacity-60'
	]}
	role="radiogroup"
	aria-label="Menge oder einzeln"
	title={locked ?? undefined}
>
	{#each options as option (option.value)}
		<button
			type="button"
			role="radio"
			aria-checked={kind === option.value}
			disabled={!!locked}
			title={locked ? undefined : option.title}
			onclick={() => {
				kind = option.value;
				onchange?.();
			}}
			class={[
				'flex items-center justify-center gap-1.5 rounded-md px-2.5 transition-colors disabled:cursor-default',
				size === 'lg' ? 'h-11 flex-1 text-base' : 'h-7 text-sm',
				kind === option.value
					? 'bg-background font-medium shadow-sm'
					: 'text-muted-foreground enabled:hover:text-foreground'
			]}
		>
			{#if option.value === 'BULK'}<LayersIcon class="size-4" />{:else}<HashIcon
					class="size-4"
				/>{/if}
			{option.label}
		</button>
	{/each}
</div>
