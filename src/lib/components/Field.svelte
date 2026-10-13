<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Label } from '#lib/components/ui/label/index.js';

	let { label, id, children }: { label: string; id: string; children: Snippet } = $props();
</script>

<div class="grid gap-2">
	<Label for={id}>{label}</Label>
	{@render children()}
</div>
