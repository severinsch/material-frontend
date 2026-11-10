<script lang="ts">
	import * as AlertDialog from '#lib/components/ui/alert-dialog/index.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let {
		open = $bindable(false),
		title,
		description,
		confirmLabel,
		cancelLabel = 'Abbrechen',
		destructive = false,
		onconfirm
	}: {
		open: boolean;
		title: string;
		description: string;
		confirmLabel: string;
		cancelLabel?: string;
		destructive?: boolean;
		/** Runs when confirmed; the dialog closes right away. */
		onconfirm: () => void;
	} = $props();
</script>

<!-- An alert dialog asking before a step that can't be undone (easily). Nested in another dialog, it keeps that one
     open and its focus trapped while asking. -->
<AlertDialog.Root bind:open>
	<AlertDialog.Content size="sm">
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>{description}</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>{cancelLabel}</AlertDialog.Cancel>
			<Button
				variant={destructive ? 'destructive' : 'default'}
				onclick={() => {
					open = false;
					onconfirm();
				}}
			>
				{confirmLabel}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
