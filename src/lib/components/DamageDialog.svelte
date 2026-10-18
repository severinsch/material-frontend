<script lang="ts">
	import {
		mutate,
		type DamageReport,
		type IndividualItem,
		type NewDamageReport
	} from '#lib/api/index.js';
	import { orNull, statusLabels } from '#lib/format.js';
	import { getTenant } from '#lib/tenant.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let open = $state(false);
	let id = $state<string | null>(null);
	let item = $state<IndividualItem | null>(null);
	/** e.g. "Jurtenfenster 3" */
	let itemName = $state('');
	let form = $state(formOf());
	/** Whether the edited report was already resolved before. */
	let wasResolved = $state(false);
	/** Whether to also change the item's status: to "In repair" for new damage, back to "Active" when resolved. */
	let changeStatus = $state(false);

	/** The status the item gets when [changeStatus] is on, if that changes anything. */
	const newStatus = $derived.by(() => {
		if (!item) return null;
		if (!id) return item.status === 'ACTIVE' ? 'IN_REPAIR' : null;
		return form.isResolved && !wasResolved && item.status === 'IN_REPAIR' ? 'ACTIVE' : null;
	});

	function formOf(report?: DamageReport) {
		return {
			description: report?.description ?? '',
			// New reports are usually made by the person entering them.
			reportedBy: report ? (report.reportedBy ?? '') : tenant.user.displayName,
			isResolved: report?.resolvedAt != null,
			resolutionNotes: report?.resolutionNotes ?? ''
		};
	}

	/** Opens the dialog to edit [report], or to report new damage on [forItem]. */
	export function show(forItem: IndividualItem, materialName: string, report?: DamageReport) {
		id = report?.id ?? null;
		item = forItem;
		itemName = `${materialName} ${forItem.identifier}`;
		form = formOf(report);
		wasResolved = form.isResolved;
		// Resolving a report usually means the item is repaired; new damage is often minor.
		changeStatus = report !== undefined;
		open = true;
	}

	function save() {
		const body: NewDamageReport = {
			...form,
			itemId: item!.id,
			reportedBy: orNull(form.reportedBy),
			resolutionNotes: orNull(form.resolutionNotes),
			itemStatus: changeStatus ? newStatus : null
		};
		const request = id
			? api.PUT('/damages/{id}', { params: { path: { id } }, body })
			: api.POST('/damages', { body });
		const statusNote = body.itemStatus ? `, Status: ${statusLabels[body.itemStatus]}` : '';
		return mutate(request, `Schadensmeldung zu ${itemName} gespeichert${statusNote}`);
	}
</script>

<FormDialog
	bind:open
	title={id ? `Schadensmeldung zu ${itemName} bearbeiten` : `Schaden an ${itemName} melden`}
	submitLabel={id ? 'Speichern' : 'Melden'}
	onsubmit={save}
>
	<Field label="Was ist beschädigt?" id="damage-description">
		<Textarea id="damage-description" bind:value={form.description} required />
	</Field>
	<Field label="Gemeldet von" id="damage-reported-by">
		<Input id="damage-reported-by" bind:value={form.reportedBy} maxlength={255} />
	</Field>
	{#if id}
		<div class="flex items-center gap-2">
			<Checkbox id="damage-resolved" bind:checked={form.isResolved} />
			<Label for="damage-resolved">Behoben</Label>
		</div>
		{#if form.isResolved}
			<Field label="Was wurde gemacht?" id="damage-resolution">
				<Textarea id="damage-resolution" bind:value={form.resolutionNotes} />
			</Field>
		{/if}
	{/if}
	{#if newStatus}
		<div class="flex items-start gap-3 rounded-md border p-3">
			<Switch id="damage-status" bind:checked={changeStatus} />
			<div class="grid gap-1">
				<Label for="damage-status">
					{itemName} auf „{statusLabels[newStatus]}“ setzen
				</Label>
				<p class="text-sm text-muted-foreground">
					{newStatus === 'IN_REPAIR'
						? 'Dann zählt der Gegenstand als beschädigt und kann nicht ausgeliehen werden.'
						: 'Dann kann der Gegenstand wieder verwendet und ausgeliehen werden.'}
				</p>
			</div>
		</div>
	{:else if item && !id && item.status !== 'ACTIVE'}
		<p class="text-sm text-muted-foreground">
			Status von {itemName}: {statusLabels[item.status]}
		</p>
	{/if}
</FormDialog>
