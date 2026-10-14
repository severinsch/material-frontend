<script lang="ts" module>
	import type { Component } from 'svelte';

	export interface RowAction {
		label: string;
		icon: Component;
		onselect: () => void;
		/** Destructive actions are listed last, separated from the others. */
		destructive?: boolean;
		disabled?: boolean;
		/** Shown below the label, e.g. why the action is disabled. */
		hint?: string;
	}
</script>

<script lang="ts">
	import EllipsisIcon from '@lucide/svelte/icons/ellipsis';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';

	let {
		name,
		onedit,
		actions = []
	}: {
		/** The object the actions belong to, for accessible names, e.g. "Hering" or "Jurtenfenster 3". */
		name: string;
		onedit?: () => void;
		actions?: RowAction[];
	} = $props();

	const regular = $derived(actions.filter((action) => !action.destructive));
	const destructive = $derived(actions.filter((action) => action.destructive));
</script>

{#snippet menuItem(action: RowAction)}
	<DropdownMenu.Item
		variant={action.destructive ? 'destructive' : 'default'}
		disabled={action.disabled}
		onSelect={action.onselect}
		class="pointer-coarse:min-h-11"
	>
		<action.icon />
		<span class="grid">
			{action.label}
			{#if action.hint}<span class="text-xs text-muted-foreground">{action.hint}</span>{/if}
		</span>
	</DropdownMenu.Item>
{/snippet}

<div class="inline-flex items-center justify-end gap-1">
	{#if onedit}
		<Button
			variant="ghost"
			size="icon-sm"
			aria-label="{name} bearbeiten"
			title="Bearbeiten"
			onclick={onedit}
		>
			<PencilIcon />
		</Button>
	{/if}
	{#if actions.length > 0}
		<DropdownMenu.Root>
			<DropdownMenu.Trigger>
				{#snippet child({ props })}
					<Button
						{...props}
						variant="ghost"
						size="icon-sm"
						aria-label="Weitere Aktionen für {name}"
						title="Weitere Aktionen"
					>
						<EllipsisIcon />
					</Button>
				{/snippet}
			</DropdownMenu.Trigger>
			<DropdownMenu.Content align="end" class="w-auto max-w-72 min-w-44">
				{#each regular as action (action.label)}
					{@render menuItem(action)}
				{/each}
				{#if regular.length > 0 && destructive.length > 0}
					<DropdownMenu.Separator />
				{/if}
				{#each destructive as action (action.label)}
					{@render menuItem(action)}
				{/each}
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	{/if}
</div>
