<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { ChangeGuard } from './change-guard.svelte.js';
	import ConfirmDiscard from './ConfirmDiscard.svelte';

	let {
		open = $bindable(false),
		title,
		description,
		submitLabel = 'Speichern',
		destructive = false,
		values,
		onsubmit,
		class: className,
		children
	}: {
		open: boolean;
		title: string;
		description?: string;
		submitLabel?: string;
		destructive?: boolean;
		/**
		 * The values edited in the dialog (state, compared as JSON). Once they differ from when the dialog opened,
		 * Escape or a tap outside ask before discarding them; until then, they close the dialog right away.
		 */
		values?: unknown;
		/** Returns whether the dialog can close. */
		onsubmit: () => Promise<boolean>;
		/** Classes of the dialog, e.g. to make it wider. */
		class?: string;
		children?: Snippet;
	} = $props();

	const guard = new ChangeGuard(() => values);

	// Dialogs set their values before opening, so they are complete by the time this runs.
	$effect(() => {
		if (open) untrack(() => guard.start());
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		void guard.save(onsubmit).then((done) => {
			if (done) open = false;
		});
	}
</script>

<Dialog.Root bind:open>
	<!-- dvh: on phones, the browser's bars don't hide the bottom of the dialog. -->
	<Dialog.Content
		class="max-h-[calc(100dvh-2rem)] overflow-y-auto {className ?? ''}"
		showCloseButton={!guard.saving}
		onEscapeKeydown={guard.intercept}
		onInteractOutside={guard.intercept}
	>
		<form onsubmit={submit} class="grid gap-4">
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				{#if description}
					<Dialog.Description>{description}</Dialog.Description>
				{/if}
			</Dialog.Header>
			{@render children?.()}
			<!-- Sticks to the bottom of the dialog, so saving stays at hand in long forms. The tint is layered over an
			     opaque background, so the form doesn't show through. Sticky offsets count from inside the dialog's
			     padding; -bottom-4 makes it flush with the edge instead of leaving a strip of the form below it. -->
			<Dialog.Footer
				class="sticky -bottom-4 z-10 bg-popover bg-linear-to-r from-muted/50 to-muted/50"
			>
				<Button
					variant="outline"
					type="button"
					onclick={() => (open = false)}
					disabled={guard.saving}
				>
					Abbrechen
				</Button>
				<Button
					type="submit"
					variant={destructive ? 'destructive' : 'default'}
					disabled={guard.saving}
				>
					{#if guard.saving}<LoaderIcon class="animate-spin" />{/if}
					{submitLabel}
				</Button>
			</Dialog.Footer>
		</form>
		<ConfirmDiscard {guard} ondiscard={() => (open = false)} />
	</Dialog.Content>
</Dialog.Root>
