<script lang="ts">
	import { mutate, type Material } from '#lib/api/index.js';
	import { setArchived } from '#lib/archive.js';
	import { getTenant } from '#lib/tenant.js';
	import FormDialog from './FormDialog.svelte';

	/** [redirectTo] is where to go after deleting, e.g. the material list from the material's page. */
	let { redirectTo }: { redirectTo?: string } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let open = $state(false);
	let material = $state<Pick<Material, 'id' | 'name' | 'archivedAt'>>({
		id: '',
		name: '',
		archivedAt: null
	});
	/**
	 * Why the material can't be deleted, if the API suggested archiving it instead (it was lent, bought or has
	 * items); the dialog then offers that.
	 */
	let archiveReason = $state<string | null>(null);

	/** Asks whether to delete [toDelete]; if that isn't possible because of its history, offers to archive it. */
	export function show(toDelete: Pick<Material, 'id' | 'name' | 'archivedAt'>) {
		material = toDelete;
		archiveReason = null;
		open = true;
	}

	function remove() {
		return mutate(
			api.DELETE('/materials/{id}', { params: { path: { id: material.id } } }),
			`${material.name} gelöscht`,
			{
				redirectTo,
				onError: (error) => {
					// An archived material just gets the message.
					if (error.code !== 'ARCHIVE_INSTEAD' || material.archivedAt) return false;
					archiveReason = error.message;
					return true;
				}
			}
		);
	}
</script>

<!-- One dialog that turns into the offer to archive, so it stays in place instead of closing and opening again. -->
<FormDialog
	bind:open
	title={archiveReason ? `„${material.name}“ archivieren?` : `Material „${material.name}“ löschen?`}
	description={archiveReason ?? 'Das kann nicht rückgängig gemacht werden.'}
	submitLabel={archiveReason ? 'Archivieren' : 'Löschen'}
	destructive={!archiveReason}
	onsubmit={() => (archiveReason ? setArchived(api, material, true) : remove())}
>
	{#if archiveReason}
		<p class="text-sm">
			Archivierte Materialien behalten ihre Ausleihen, Einkäufe und Gegenstände, erscheinen aber
			nicht mehr in der Materialliste, in Sets und beim Ausleihen. Du kannst es jederzeit wieder aus
			dem Archiv holen.
		</p>
	{/if}
</FormDialog>
