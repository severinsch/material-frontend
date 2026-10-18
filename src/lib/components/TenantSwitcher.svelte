<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import ChevronsUpDownIcon from '@lucide/svelte/icons/chevrons-up-down';
	import type { UserTenant } from '#lib/api/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';

	let { tenants, current }: { tenants: UserTenant[]; current: UserTenant } = $props();
</script>

{#if tenants.length > 1}
	<DropdownMenu.Root>
		<DropdownMenu.Trigger>
			{#snippet child({ props })}
				<Button
					{...props}
					variant="ghost"
					class="max-w-48 px-2"
					aria-label="Stamm wechseln, aktuell {current.name}"
				>
					<span class="truncate">{current.name}</span>
					<ChevronsUpDownIcon class="text-muted-foreground" />
				</Button>
			{/snippet}
		</DropdownMenu.Trigger>
		<DropdownMenu.Content align="start">
			{#each tenants as tenant (tenant.id)}
				<DropdownMenu.Item>
					{#snippet child({ props })}
						<a
							{...props}
							href="/{tenant.slug}"
							aria-current={tenant.id === current.id ? 'page' : undefined}
						>
							<CheckIcon class={tenant.id === current.id ? '' : 'invisible'} />
							{tenant.name}
						</a>
					{/snippet}
				</DropdownMenu.Item>
			{/each}
		</DropdownMenu.Content>
	</DropdownMenu.Root>
{:else}
	<span class="truncate px-2 text-sm text-muted-foreground">{current.name}</span>
{/if}
