<!-- A note with its checklist; boxes can be ticked in place where [ontoggle] is given. -->
<script lang="ts">
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { parseNote } from '#lib/tasks.js';

	let { note, ontoggle }: { note: string | null | undefined; ontoggle?: (index: number) => void } =
		$props();
	const lines = $derived(parseNote(note));
</script>

{#if lines.length > 0}
	<div class="space-y-1 text-sm">
		{#each lines as line, i (i)}
			{#if line.check}
				<label class="flex items-start gap-2 py-0.5">
					<Checkbox
						class="mt-0.5"
						checked={line.done}
						onCheckedChange={() => ontoggle?.(i)}
						disabled={!ontoggle}
					/>
					<span class={line.done ? 'text-muted-foreground line-through' : ''}>{line.text}</span>
				</label>
			{:else if line.text}
				<p class="whitespace-pre-wrap">{line.text}</p>
			{:else}
				<div class="h-2"></div>
			{/if}
		{/each}
	</div>
{/if}
