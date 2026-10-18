<script lang="ts">
	import FormDialog from './FormDialog.svelte';

	const defaults = { verb: 'löschen', description: 'Das kann nicht rückgängig gemacht werden.' };

	let open = $state(false);
	let name = $state('');
	let ondelete = $state<() => Promise<boolean>>(async () => false);
	let wording = $state(defaults);

	/**
	 * Asks whether to delete [what] (e.g. `Material „Hering“`) and runs [action] if confirmed. [verb] and
	 * [description] replace "löschen" and the warning for other destructive actions, e.g. removing a member.
	 */
	export function show(
		what: string,
		action: () => Promise<boolean>,
		options: Partial<typeof defaults> = {}
	) {
		name = what;
		ondelete = action;
		wording = { ...defaults, ...options };
		open = true;
	}
</script>

<FormDialog
	bind:open
	title="{name} {wording.verb}?"
	description={wording.description}
	submitLabel={wording.verb.charAt(0).toUpperCase() + wording.verb.slice(1)}
	destructive
	onsubmit={() => ondelete()}
/>
