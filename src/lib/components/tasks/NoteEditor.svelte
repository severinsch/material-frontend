<!-- The note editor: plain text, any line can become a checkbox (small button in the corner, or "[] " at its start). -->
<script lang="ts">
	import { tick } from 'svelte';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { parseNote, pasteLines, serializeNote, type NoteLine } from '#lib/tasks.js';

	let {
		note = $bindable(),
		id,
		label
	}: {
		note: string;
		/** The first line's id, for a `Field`'s label. */
		id: string;
		/** The note's name for screen readers, if it has no visible label. */
		label?: string;
	} = $props();

	const initial = parseNote(note);
	let lines = $state<NoteLine[]>(
		initial.length ? initial : [{ check: false, done: false, text: '' }]
	);
	let rows: HTMLTextAreaElement[] = $state([]);
	let focused = $state(0);

	const serialize = () => serializeNote(lines).replace(/\n+$/, '');
	/**
	 * The note is written back only once the user changed it: serializing tidies it (e.g. "[x]foo" becomes "[x] foo"),
	 * which must not make an untouched form count as changed.
	 */
	const untouched = serialize();
	let changed = false;
	$effect(() => {
		const value = serialize();
		changed ||= value !== untouched;
		if (changed) note = value;
	});

	/** Focuses line [index], with the cursor at [at] if given. */
	async function focusRow(index: number, at?: number) {
		await tick();
		const row = rows[index];
		row?.focus();
		if (row && at !== undefined) row.setSelectionRange(at, at);
	}

	function keydown(event: KeyboardEvent, index: number) {
		const line = lines[index];
		const row = event.currentTarget as HTMLTextAreaElement;
		// Shift+Enter too: a line can't hold a line break (it would break a checkbox line when saved).
		if (event.key === 'Enter') {
			event.preventDefault();
			// Enter on an empty checkbox ends the list, like in notes apps.
			if (line.check && !line.text) {
				line.check = false;
				return;
			}
			// A selection is replaced, as when typing.
			const rest = line.text.slice(row.selectionEnd);
			line.text = line.text.slice(0, row.selectionStart);
			lines.splice(index + 1, 0, { check: line.check, done: false, text: rest });
			void focusRow(index + 1);
		} else if (event.key === 'Backspace' && row.selectionStart === 0 && row.selectionEnd === 0) {
			if (line.check) {
				event.preventDefault();
				line.check = false;
			} else if (index > 0) {
				event.preventDefault();
				const previous = lines[index - 1];
				const at = previous.text.length;
				previous.text += line.text;
				lines.splice(index, 1);
				void focusRow(index - 1, at);
			}
		} else if (event.key === 'ArrowUp' && index > 0 && row.selectionStart === 0) {
			void focusRow(index - 1, lines[index - 1].text.length);
		} else if (
			event.key === 'ArrowDown' &&
			index < lines.length - 1 &&
			row.selectionStart === row.value.length
		) {
			void focusRow(index + 1);
		}
	}

	/** Pastes several lines as lines of the note, since a line can't hold a line break. */
	function paste(event: ClipboardEvent, index: number) {
		const text = event.clipboardData?.getData('text/plain') ?? '';
		if (!/[\r\n]/.test(text)) return;
		event.preventDefault();
		const row = event.currentTarget as HTMLTextAreaElement;
		const pasted = pasteLines(lines[index], row.selectionStart, row.selectionEnd, text);
		lines.splice(index, 1, ...pasted.lines);
		void focusRow(index + pasted.lines.length - 1, pasted.cursor);
	}

	function input(index: number) {
		const line = lines[index];
		// "[] " or "- [ ] " at the start makes a checkbox.
		const m = /^(-\s*)?\[ ?\]\s(.*)$/s.exec(line.text);
		if (!line.check && m) {
			line.check = true;
			line.text = m[2];
		}
	}

	/** Turns the line with the cursor into a checkbox (or back), or starts a checklist at the end. */
	function toggleCheck() {
		let line = lines[focused];
		if (!line || document.activeElement !== rows[focused]) {
			const last = lines.at(-1)!;
			line = last.text || last.check ? { check: false, done: false, text: '' } : last;
			if (line !== last) lines.push(line);
			line.check = true;
		} else {
			line.check = !line.check;
		}
		void focusRow(lines.indexOf(line), line.text.length);
	}
</script>

<div
	role="group"
	aria-label={label}
	class="relative rounded-lg border border-input px-2.5 py-1.5 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-input/30"
>
	{#each lines as line, i (i)}
		<div class="flex items-start gap-2">
			{#if line.check}
				<Checkbox
					class="mt-1.5"
					bind:checked={line.done}
					aria-label={line.text ? `„${line.text}“ abgehakt` : 'Abgehakt'}
				/>
			{/if}
			<textarea
				id={i === 0 ? id : undefined}
				aria-label={i === 0 ? label : `Zeile ${i + 1}`}
				bind:this={rows[i]}
				bind:value={line.text}
				rows="1"
				placeholder={lines.length === 1 && i === 0 ? 'Notiz (optional)' : ''}
				class={[
					'field-sizing-content min-h-0 w-full resize-none bg-transparent py-1 text-base outline-none placeholder:text-muted-foreground md:text-sm',
					i === lines.length - 1 && 'pr-7 pointer-coarse:pr-9',
					line.check && line.done && 'text-muted-foreground line-through'
				]}
				onkeydown={(e) => keydown(e, i)}
				onpaste={(e) => paste(e, i)}
				oninput={() => input(i)}
				onfocus={() => (focused = i)}></textarea>
		</div>
	{/each}
	<!-- Small, in the corner: plain text is the usual case. Its touch target reaches beyond it (44 px). -->
	<button
		type="button"
		class="absolute right-1 bottom-1 rounded-md p-1.5 text-muted-foreground/70 hover:bg-muted hover:text-foreground pointer-coarse:after:absolute pointer-coarse:after:-inset-2"
		title="Kästchen (oder „[] “ am Zeilenanfang tippen)"
		aria-label="Zeile zum Kästchen machen"
		onmousedown={(e) => e.preventDefault()}
		onclick={toggleCheck}
	>
		<ListChecksIcon class="size-4" />
	</button>
</div>
