<script lang="ts">
	import '../app.css';
	import { Package, Boxes } from 'lucide-svelte';
	import { Toaster } from '$lib/components/ui/sonner';
	import { page } from '$app/stores';

	let { children } = $props();
</script>

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
		<div class="container flex h-14 items-center gap-6 px-4">
			<a href="/" class="flex items-center gap-2 font-semibold">
				<img src="/logo.png" alt="Logo" class="h-6 w-6" />
				<span>Material Management</span>
			</a>
			<nav class="flex items-center gap-4 text-sm">
				<a
					href="/"
					class="flex items-center gap-1 transition-colors hover:text-foreground {$page.url.pathname === '/' ? 'text-foreground font-medium' : 'text-muted-foreground'}"
				>
					<Package class="h-4 w-4" />
					Materials
				</a>
				<a
					href="/kits"
					class="flex items-center gap-1 transition-colors hover:text-foreground {$page.url.pathname === '/kits' ? 'text-foreground font-medium' : 'text-muted-foreground'}"
				>
					<Boxes class="h-4 w-4" />
					Kits
				</a>
			</nav>
		</div>
	</header>

	<main class="container px-4 py-6">
		{@render children()}
	</main>
</div>

<Toaster richColors />
