<script lang="ts">
	import LogOutIcon from '@lucide/svelte/icons/log-out';
	import ShieldIcon from '@lucide/svelte/icons/shield';
	import UserIcon from '@lucide/svelte/icons/user';
	import UsersIcon from '@lucide/svelte/icons/users';
	import type { CurrentUser, UserTenant } from '#lib/api/index.js';
	import { hasPermission } from '#lib/permissions.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';

	let { user, tenant }: { user: CurrentUser; tenant?: UserTenant } = $props();

	let logoutForm: HTMLFormElement;
</script>

<!-- Logging out is a POST, so link prefetching can't end the session. -->
<form method="POST" action="/logout" bind:this={logoutForm} hidden></form>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button
				{...props}
				variant="ghost"
				size="icon"
				aria-label="Benutzermenü"
				title={user.displayName}
			>
				<UserIcon />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end" class="min-w-48">
		<DropdownMenu.Label class="font-normal">
			<span class="block font-medium">{user.displayName}</span>
			{#if user.username}<span class="text-xs text-muted-foreground">{user.username}</span>{/if}
		</DropdownMenu.Label>
		<DropdownMenu.Separator />
		<DropdownMenu.Item>
			{#snippet child({ props })}<a {...props} href="/account"><UserIcon />Mein Konto</a>{/snippet}
		</DropdownMenu.Item>
		{#if tenant && hasPermission(tenant.role, 'VIEW_MEMBERS')}
			<DropdownMenu.Item>
				{#snippet child({ props })}
					<a {...props} href="/{tenant.slug}/members"><UsersIcon />Mitglieder</a>
				{/snippet}
			</DropdownMenu.Item>
		{/if}
		{#if user.isPlatformAdmin}
			<DropdownMenu.Item>
				{#snippet child({ props })}<a {...props} href="/admin"><ShieldIcon />Verwaltung</a
					>{/snippet}
			</DropdownMenu.Item>
		{/if}
		<DropdownMenu.Separator />
		<DropdownMenu.Item onSelect={() => logoutForm.requestSubmit()}>
			<LogOutIcon />Abmelden
		</DropdownMenu.Item>
	</DropdownMenu.Content>
</DropdownMenu.Root>
