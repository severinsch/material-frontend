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
	import ThemeToggle from '#lib/components/ThemeToggle.svelte';
	import { Toaster } from '#lib/components/ui/sonner/index.js';

	let { children } = $props();

	const links: { href: string; label: string; icon: Component }[] = [
		{ href: '/', label: 'Materialien', icon: PackageIcon },
		{ href: '/kits', label: 'Sets', icon: BoxesIcon },
		{ href: '/loans', label: 'Ausleihen', icon: HandshakeIcon },
		{ href: '/locations', label: 'Lagerorte', icon: MapPinIcon },
		{ href: '/overview', label: 'Übersicht', icon: LayoutDashboardIcon }
	];

	function isActive(href: string) {
		const path = page.url.pathname;
		return href === '/' ? path === '/' || path.startsWith('/materials') : path.startsWith(href);
	}
</script>

<ModeWatcher />

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur print:hidden">
		<div class="container mx-auto flex h-14 items-center gap-6 px-4">
			<a href="/" class="flex items-center gap-2 font-semibold">
				<img src="/logo.png" alt="" class="size-6" />
				<span class="sm:max-lg:sr-only">Materialverwaltung</span>
			</a>
			<nav aria-label="Hauptnavigation" class="hidden items-center gap-4 text-sm sm:flex">
				{#each links as link (link.href)}
					<a
						href={link.href}
						aria-current={isActive(link.href) ? 'page' : undefined}
						class={[
							'flex items-center gap-1.5 transition-colors hover:text-foreground',
							isActive(link.href) ? 'font-medium text-foreground' : 'text-muted-foreground'
						]}
					>
						<link.icon class="size-4" />
						{link.label}
					</a>
				{/each}
			</nav>
			<div class="ml-auto">
				<ThemeToggle />
			</div>
		</div>
	</header>

	<main class="container mx-auto px-4 pt-6 pb-24 sm:pb-6 print:p-0">
		{@render children()}
	</main>

	<!-- On phones the navigation sits at the bottom, within reach of the thumb. -->
	<nav
		aria-label="Hauptnavigation"
		class="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t bg-background/95 backdrop-blur sm:hidden print:hidden"
	>
		{#each links as link (link.href)}
			<a
				href={link.href}
				aria-current={isActive(link.href) ? 'page' : undefined}
				class={[
					'flex flex-col items-center justify-center gap-0.5 text-xs',
					isActive(link.href) ? 'font-medium text-foreground' : 'text-muted-foreground'
				]}
			>
				<link.icon class="size-5" />
				{link.label}
			</a>
		{/each}
	</nav>
</div>

<Toaster richColors position="top-center" />
