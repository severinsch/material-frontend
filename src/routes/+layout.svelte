<script lang="ts">
	import '../app.css';
	import type { Component } from 'svelte';
	import BoxesIcon from '@lucide/svelte/icons/boxes';
	import HandshakeIcon from '@lucide/svelte/icons/handshake';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import PackageIcon from '@lucide/svelte/icons/package';
	import { page } from '$app/state';
	import { Toaster } from '#lib/components/ui/sonner/index.js';

	let { children } = $props();

	const links: { href: string; label: string; icon: Component }[] = [
		{ href: '/', label: 'Materials', icon: PackageIcon },
		{ href: '/kits', label: 'Kits', icon: BoxesIcon },
		{ href: '/loans', label: 'Loans', icon: HandshakeIcon },
		{ href: '/locations', label: 'Locations', icon: MapPinIcon }
	];

	function isActive(href: string) {
		const path = page.url.pathname;
		return href === '/' ? path === '/' || path.startsWith('/materials') : path.startsWith(href);
	}
</script>

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
		<div class="container mx-auto flex h-14 items-center gap-6 px-4">
			<a href="/" class="flex items-center gap-2 font-semibold">
				<img src="/logo.png" alt="" class="size-6" />
				<span class="hidden sm:inline">Material Management</span>
			</a>
			<nav class="flex items-center gap-4 text-sm">
				{#each links as link (link.href)}
					<a
						href={link.href}
						class={[
							'flex items-center gap-1 transition-colors hover:text-foreground',
							isActive(link.href) ? 'font-medium text-foreground' : 'text-muted-foreground'
						]}
					>
						<link.icon class="size-4" />
						<span class="hidden sm:inline">{link.label}</span>
					</a>
				{/each}
			</nav>
		</div>
	</header>

	<main class="container mx-auto px-4 py-6">
		{@render children()}
	</main>
</div>

<Toaster richColors />
