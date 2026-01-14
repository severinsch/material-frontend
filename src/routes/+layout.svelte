<script lang="ts">
	import '../app.css';
	import { Package } from 'lucide-svelte';
	import { Toaster } from '$lib/components/ui/sonner';

	let { children } = $props();
</script>

<div class="min-h-screen bg-background">
	<header class="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
		<div class="container flex h-14 items-center px-4">
			<a href="/" class="flex items-center gap-2 font-semibold">
				<Package class="h-5 w-5" />
				<span>Scout Materials</span>
			</a>
		</div>
	</header>

	<main class="container px-4 py-6">
		{@render children()}
	</main>
</div>

<Toaster richColors />
