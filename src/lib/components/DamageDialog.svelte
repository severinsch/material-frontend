<script lang="ts">
	import { api, mutate, type DamageReport } from '#lib/api/index.js';
	import { orNull } from '#lib/format.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	let open = $state(false);
	let id = $state<string | null>(null);
	let itemId = $state('');
	let form = $state(formOf());

	function formOf(report?: DamageReport) {
		return {
			description: report?.description ?? '',
			reportedBy: report?.reportedBy ?? '',
			isResolved: report?.resolvedAt != null,
			resolutionNotes: report?.resolutionNotes ?? ''
		};
	}

	/** Opens the dialog to edit [report], or to report new damage on the item. */
	export function show(forItem: string, report?: DamageReport) {
		id = report?.id ?? null;
		itemId = forItem;
		form = formOf(report);
		open = true;
	}

	function save() {
		const body = {
			...form,
			itemId,
			reportedBy: orNull(form.reportedBy),
			resolutionNotes: orNull(form.resolutionNotes)
		};
		const request = id
			? api.PUT('/damages/{id}', { params: { path: { id } }, body })
			: api.POST('/damages', { body });
		return mutate(request, 'Saved damage report');
	}
</script>

<FormDialog
	bind:open
	title={id ? 'Edit damage report' : 'Report damage'}
	description="Damage reports are a record only. Change the item's condition or status separately."
	onsubmit={save}
>
	<Field label="What is damaged?" id="damage-description">
		<Textarea id="damage-description" bind:value={form.description} required />
	</Field>
	<Field label="Reported by" id="damage-reported-by">
		<Input id="damage-reported-by" bind:value={form.reportedBy} maxlength={255} />
	</Field>
	{#if id}
		<div class="flex items-center gap-2">
			<Checkbox id="damage-resolved" bind:checked={form.isResolved} />
			<Label for="damage-resolved">Resolved</Label>
		</div>
		{#if form.isResolved}
			<Field label="Resolution" id="damage-resolution">
				<Textarea id="damage-resolution" bind:value={form.resolutionNotes} />
			</Field>
		{/if}
	{/if}
</FormDialog>
