<script lang="ts">
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import RotateCwIcon from '@lucide/svelte/icons/rotate-cw';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import ServerOffIcon from '@lucide/svelte/icons/server-off';
	import ShieldXIcon from '@lucide/svelte/icons/shield-x';
	import { page } from '$app/state';
	import { errorText } from '#lib/errors.js';
	import { Button } from '#lib/components/ui/button/index.js';

	const text = $derived(errorText(page.status, page.error?.message));
	const Icon = $derived(
		page.status >= 502 && page.status <= 504
			? ServerOffIcon
			: page.status === 404
				? SearchXIcon
				: page.status === 403
					? ShieldXIcon
					: CircleAlertIcon
	);
</script>

<svelte:head><title>{text.title} – Materialverwaltung</title></svelte:head>

<div class="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
	<div class="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
		<Icon class="size-6" />
	</div>
	<div class="space-y-2">
		<h1 class="text-2xl font-bold tracking-tight">{text.title}</h1>
		<p class="text-muted-foreground">{text.text}</p>
	</div>
	<div class="flex flex-wrap justify-center gap-2">
		<!-- A full reload, which also retries what failed before the page could load (e.g. the login check). -->
		<Button onclick={() => location.reload()}><RotateCwIcon />Neu laden</Button>
		{#if text.offerHome}
			<Button variant="outline" href="/">Zur Startseite</Button>
		{/if}
	</div>
	<p class="text-xs text-muted-foreground">Fehler {page.status}</p>
</div>
