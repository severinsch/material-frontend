<script lang="ts">
	import type { Snippet } from 'svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';

	let {
		open = $bindable(false),
		title,
		description,
		submitLabel = 'Save',
		destructive = false,
		onsubmit,
		children
	}: {
		open: boolean;
		title: string;
		description?: string;
		submitLabel?: string;
		destructive?: boolean;
		/** Returns whether the dialog can close. */
		onsubmit: () => Promise<boolean>;
		children?: Snippet;
	} = $props();

	let saving = $state(false);

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		try {
			if (await onsubmit()) open = false;
		} finally {
			saving = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content class="max-h-[90vh] overflow-y-auto">
		<form onsubmit={submit} class="grid gap-4">
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if description}
					<Dialog.Description>{description}</Dialog.Description>
				{/if}
			</Dialog.Header>
			{@render children?.()}
			<Dialog.Footer>
				<Button variant="outline" type="button" onclick={() => (open = false)} disabled={saving}>
					Cancel
				</Button>
				<Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={saving}>
					{#if saving}<LoaderIcon class="animate-spin" />{/if}
					{submitLabel}
				</Button>
			</Dialog.Footer>
		</form>
	</Dialog.Content>
</Dialog.Root>
