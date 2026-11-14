<!-- Asks whether to discard a form's changes when [guard] stopped Escape or a tap outside. Place it inside the dialog
     content, which keeps the dialog open and its focus trapped while asking. -->
<script lang="ts">
	import type { ChangeGuard } from './change-guard.svelte.js';
	import ConfirmDialog from './ConfirmDialog.svelte';

	let { guard, ondiscard }: { guard: ChangeGuard; ondiscard: () => void } = $props();
</script>

<ConfirmDialog
	bind:open={guard.confirming}
	title="Änderungen verwerfen?"
	description="Was du eingegeben hast, geht verloren."
	cancelLabel="Weiter bearbeiten"
	confirmLabel="Verwerfen"
	destructive
	onconfirm={ondiscard}
/>
