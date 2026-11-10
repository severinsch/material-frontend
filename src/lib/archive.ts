import ArchiveIcon from '@lucide/svelte/icons/archive';
import ArchiveRestoreIcon from '@lucide/svelte/icons/archive-restore';
import Trash2Icon from '@lucide/svelte/icons/trash-2';
import { mutate, type Material, type TenantApi } from '#lib/api/index.js';
import type { RowAction } from '#lib/components/RowActions.svelte';

type MaterialRef = Pick<Material, 'id' | 'name' | 'archivedAt'>;

/**
 * Archives [material] (or takes it out of the archive), with "Undo" in the toast. Archived materials keep their
 * history but disappear from lists, sets and loans; the API refuses to archive one used in a kit, with a message.
 */
export function setArchived(
	api: TenantApi,
	material: Pick<Material, 'id' | 'name'>,
	archived: boolean
): Promise<boolean> {
	const path = { params: { path: { id: material.id } } };
	const request = (archive: boolean) =>
		archive
			? api.POST('/materials/{id}/archive', path)
			: api.POST('/materials/{id}/unarchive', path);
	return mutate(
		request(archived),
		archived ? `${material.name} archiviert` : `${material.name} aus dem Archiv geholt`,
		{ undo: () => request(!archived) }
	);
}

/**
 * The menu actions for [material] in the list and on its page: archiving (or taking it out of the archive, unless
 * [offerUnarchive] is false because the page offers that elsewhere) and deleting, which [ondelete] asks about.
 */
export function materialActions(
	api: TenantApi,
	material: MaterialRef,
	{ ondelete, offerUnarchive = true }: { ondelete: () => void; offerUnarchive?: boolean }
): RowAction[] {
	const archiving: RowAction[] = material.archivedAt
		? offerUnarchive
			? [
					{
						label: 'Aus dem Archiv holen',
						icon: ArchiveRestoreIcon,
						onselect: () => void setArchived(api, material, false)
					}
				]
			: []
		: [
				{
					label: 'Archivieren',
					icon: ArchiveIcon,
					hint: 'Nicht mehr in Gebrauch, z. B. verkauft',
					onselect: () => void setArchived(api, material, true)
				}
			];
	return [
		...archiving,
		{ label: 'Löschen', icon: Trash2Icon, destructive: true, onselect: ondelete }
	];
}
