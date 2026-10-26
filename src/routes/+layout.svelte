<script lang="ts">
	import '../app.css';
	import type { Component } from 'svelte';
	import BoxesIcon from '@lucide/svelte/icons/boxes';
	import HandshakeIcon from '@lucide/svelte/icons/handshake';
	import LayoutDashboardIcon from '@lucide/svelte/icons/layout-dashboard';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import PackageIcon from '@lucide/svelte/icons/package';
	import { ModeWatcher } from 'mode-watcher';
	import { page } from '$app/state';
	import type { UserTenant } from '#lib/api/index.js';
	import { hasPermission, type Permission } from '#lib/permissions.js';
	import TenantSwitcher from '#lib/components/TenantSwitcher.svelte';
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import UserMenu from '#lib/components/UserMenu.svelte';
	import { Separator } from '#lib/components/ui/separator/index.js';
	import { Toaster } from '#lib/components/ui/sonner/index.js';

	let { data, children } = $props();

	/** The tenant of the current page, if any (set by `[tenant]/+layout.server.ts`). */
	const tenant = $derived(page.data.tenant as UserTenant | undefined);
	const user = $derived(data.user);

	const pages: { path: string; label: string; icon: Component; permission?: Permission }[] = [
		{ path: '', label: 'Materialien', icon: PackageIcon },
		{ path: '/kits', label: 'Sets', icon: BoxesIcon },
		{ path: '/loans', label: 'Ausleihen', icon: HandshakeIcon },
		{ path: '/locations', label: 'Lagerorte', icon: MapPinIcon },
		{ path: '/overview', label: 'Übersicht', icon: LayoutDashboardIcon, permission: 'EDIT' }
	];

	const links = $derived(
		tenant
			? pages
					.filter((link) => !link.permission || hasPermission(tenant.role, link.permission))
					.map((link) => ({ ...link, href: `/${tenant.slug}${link.path}` }))
			: []
	);

	function isActive(path: string) {
		const relative = page.url.pathname.slice(`/${tenant?.slug}`.length);
		return path === ''
			? relative === '' || relative === '/' || relative.startsWith('/materials')
			: relative.startsWith(path);
	}
</script>

<ModeWatcher />

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur print:hidden">
		<div class="container mx-auto flex h-14 items-center gap-4 px-4">
			<!-- The Stamm reads as the context of the pages, like a breadcrumb after the logo, not as one of them. -->
			<div class="flex min-w-0 items-center gap-2">
				<a
					href={tenant ? `/${tenant.slug}` : '/'}
					class="flex shrink-0 items-center gap-2 font-semibold"
				>
					<img src="/logo.png" alt="" class="size-6" />
					<span class={tenant ? 'sr-only xl:not-sr-only' : ''}>Materialverwaltung</span>
				</a>
				{#if tenant && user}
					<span aria-hidden="true" class="text-lg font-light text-muted-foreground/50">/</span>
					<TenantSwitcher tenants={user.tenants} current={tenant} />
				{/if}
			</div>
			{#if links.length > 0}
				<Separator orientation="vertical" class="hidden sm:block" />
			{/if}
			<nav aria-label="Hauptnavigation" class="hidden items-center gap-4 text-sm sm:flex">
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={isActive(link.path) ? 'page' : undefined}
						class={[
							'flex items-center gap-1.5 transition-colors hover:text-foreground',
							isActive(link.path) ? 'font-medium text-foreground' : 'text-muted-foreground'
						]}
					>
						<link.icon class="size-4 md:max-lg:hidden" />
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="ml-auto flex items-center gap-1">
				<ThemeToggle />
				{#if user}<UserMenu {user} {tenant} />{/if}
			</div>
		</div>
	</header>

	<main class="container mx-auto px-4 pt-6 pb-24 sm:pb-6 print:p-0">
		{@render children()}
	</main>

	{#if links.length > 0}
		<!-- On phones the navigation sits at the bottom, within reach of the thumb. -->
		<nav
			aria-label="Hauptnavigation"
			class="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t bg-background/95 backdrop-blur sm:hidden print:hidden"
		>
			{#each links as link (link.href)}
				<a
					href={link.href}
					aria-current={isActive(link.path) ? 'page' : undefined}
					class={[
						'flex flex-col items-center justify-center gap-0.5 text-xs',
						isActive(link.path) ? 'font-medium text-foreground' : 'text-muted-foreground'
					]}
				>
					<link.icon class="size-5" />
					{link.label}
				</a>
			{/each}
		</nav>
	{/if}
</div>

<Toaster richColors position="top-center" />
