<script lang="ts">
	import LinkIcon from '@lucide/svelte/icons/link';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import UserMinusIcon from '@lucide/svelte/icons/user-minus';
	import { mutate, type Member } from '#lib/api/index.js';
	import { roleLabels } from '#lib/permissions.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import MemberDialog from '#lib/components/MemberDialog.svelte';
	import RowActions from '#lib/components/RowActions.svelte';
	import SetupLinkDialog from '#lib/components/SetupLinkDialog.svelte';

	let { data } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const canManage = $derived(tenant.can('MANAGE_MEMBERS'));

	let memberDialog: MemberDialog;
	let setupLinkDialog: SetupLinkDialog;
	let confirmRemove: ConfirmDelete;

	const path = (member: Member) => ({ params: { path: { userId: member.userId } } });

	function newSetupLink(member: Member) {
		return mutate(
			api.POST('/members/{userId}/setup-link', path(member)),
			`Neuer Einrichtungslink für ${member.displayName}`,
			{ onSuccess: (link) => setupLinkDialog.show(member.displayName, link) }
		);
	}

	function remove(member: Member) {
		confirmRemove.show(
			`${member.displayName} aus ${tenant.tenant.name}`,
			() => mutate(api.DELETE('/members/{userId}', path(member)), `${member.displayName} entfernt`),
			{
				verb: 'entfernen',
				description: 'Das Konto bleibt bestehen, hat aber keinen Zugriff mehr auf diesen Stamm.'
			}
		);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Mitglieder</h1>
			<p class="text-muted-foreground">
				Wer auf das Material von {tenant.tenant.name} zugreifen kann.
			</p>
		</div>
		{#if canManage}
			<Button onclick={() => memberDialog.show()}><PlusIcon />Konto anlegen</Button>
		{/if}
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head class="hidden sm:table-cell">Benutzername</Table.Head>
					<Table.Head>Rolle</Table.Head>
					<Table.Head class="w-20"><span class="sr-only">Aktionen</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.members as member (member.userId)}
					<Table.Row class={member.isDisabled ? 'text-muted-foreground' : ''}>
						<Table.Cell class="whitespace-normal">
							<span class="font-medium">{member.displayName}</span>
							{#if member.setupPending}<Badge variant="outline">Einrichtung ausstehend</Badge>{/if}
							{#if member.isDisabled}<Badge variant="secondary">deaktiviert</Badge>{/if}
							{#if member.username}
								<p class="text-sm text-muted-foreground sm:hidden">{member.username}</p>
							{/if}
						</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">{member.username ?? '—'}</Table.Cell>
						<Table.Cell>{roleLabels[member.role]}</Table.Cell>
						<Table.Cell class="text-right">
							{#if canManage}
								<RowActions
									name={member.displayName}
									onedit={() => memberDialog.show(member)}
									actions={[
										...(member.username && !member.isDisabled
											? [
													{
														label: member.setupPending
															? 'Neuer Einrichtungslink'
															: 'Link zum Zurücksetzen des Passworts',
														icon: LinkIcon,
														onselect: () => newSetupLink(member)
													}
												]
											: []),
										{
											label: 'Aus dem Stamm entfernen',
											icon: UserMinusIcon,
											destructive: true,
											onselect: () => remove(member)
										}
									]}
								/>
							{/if}
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={4} class="py-8 text-center text-muted-foreground">
							Noch keine Mitglieder.
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<MemberDialog
	bind:this={memberDialog}
	oncreated={(member, link) => setupLinkDialog.show(member.displayName, link)}
/>
<SetupLinkDialog bind:this={setupLinkDialog} />
<ConfirmDelete bind:this={confirmRemove} />
