<script lang="ts">
	import FormDialog from './FormDialog.svelte';

	let open = $state(false);
	let name = $state('');
	let ondelete = $state<() => Promise<boolean>>(async () => false);

	/** Asks whether to delete [what] (e.g. `Material „Hering“`) and runs [action] if confirmed. */
	export function show(what: string, action: () => Promise<boolean>) {
		name = what;
		ondelete = action;
		open = true;
	}
</script>

<FormDialog
	bind:open
	title="{name} löschen?"
	description="Das kann nicht rückgängig gemacht werden."
	submitLabel="Löschen"
	destructive
	onsubmit={() => ondelete()}
/>
