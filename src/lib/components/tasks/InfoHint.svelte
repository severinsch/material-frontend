<!-- A small info icon; a click or tap shows the text, another one (or Escape, or a click elsewhere) hides it. -->
<script lang="ts">
	import InfoIcon from '@lucide/svelte/icons/info';
	import * as Popover from '#lib/components/ui/popover/index.js';

	/** [label] names the icon for screen readers, e.g. "Erklärung: Routinen". */
	let { text, label }: { text: string; label: string } = $props();
</script>

<Popover.Root>
	<Popover.Trigger
		class="inline-flex size-6 items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground pointer-coarse:size-11"
		aria-label={label}
	>
		<InfoIcon class="size-4" />
	</Popover.Trigger>
	<Popover.Content class="w-64 text-sm" side="top">{text}</Popover.Content>
</Popover.Root>
