<script lang="ts">
	import ArchiveRestoreIcon from '@lucide/svelte/icons/archive-restore';
	import LinkIcon from '@lucide/svelte/icons/link';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UserPlusIcon from '@lucide/svelte/icons/user-plus';
	import UsersIcon from '@lucide/svelte/icons/users';
	import { goto } from '$app/navigation';
	import { api, mutate, type Tenant, type User } from '#lib/api/index.js';
	import { formatDate } from '#lib/format.js';
	import { roleLabels } from '#lib/permissions.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import MembershipDialog from '#lib/components/MembershipDialog.svelte';
	import RowActions from '#lib/components/RowActions.svelte';
	import SetupLinkDialog from '#lib/components/SetupLinkDialog.svelte';
	import TenantDialog from '#lib/components/TenantDialog.svelte';
	import UserDialog from '#lib/components/UserDialog.svelte';

	let { data } = $props();

	const tenantNames = $derived(new Map(data.tenants.map((tenant) => [tenant.id, tenant.name])));

	let tenantDialog: TenantDialog;
	let userDialog: UserDialog;
	let membershipDialog: MembershipDialog;
	let setupLinkDialog: SetupLinkDialog;
	let confirmDelete: ConfirmDelete;

	const tenantPath = (tenant: Tenant) => ({ params: { path: { tenantId: tenant.id } } });
	const userPath = (user: User) => ({ params: { path: { userId: user.id } } });

	function removeTenant(tenant: Tenant) {
		confirmDelete.show(
			tenant.name,
			() =>
				mutate(api.DELETE('/tenants/{tenantId}', tenantPath(tenant)), `${tenant.name} gelöscht`),
			{
				description:
					'Der Stamm und sein Material sind dann für niemanden mehr erreichbar. Du kannst ihn hier wiederherstellen.'
			}
		);
	}

	function restoreTenant(tenant: Tenant) {
		return mutate(
			api.POST('/tenants/{tenantId}/restore', tenantPath(tenant)),
			`${tenant.name} wiederhergestellt`
		);
	}

	function newSetupLink(user: User) {
		return mutate(
			api.POST('/users/{userId}/setup-link', userPath(user)),
			`Neuer Einrichtungslink für ${user.displayName}`,
			{ onSuccess: (link) => setupLinkDialog.show(user.displayName, link) }
		);
	}

	function removeUser(user: User) {
		confirmDelete.show(`Konto von ${user.displayName}`, () =>
			mutate(api.DELETE('/users/{userId}', userPath(user)), `${user.displayName} gelöscht`)
		);
	}
</script>

<svelte:head><title>Verwaltung – Materialverwaltung</title></svelte:head>

<div class="space-y-8">
	<section class="space-y-4">
		<div class="flex items-center justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold tracking-tight">Stämme</h1>
				<p class="text-muted-foreground">
					Ein neuer Stamm hat noch keine Mitglieder: Leg dort zuerst ein Konto als Admin an.
				</p>
			</div>
			<Button onclick={() => tenantDialog.show()}><PlusIcon />Stamm anlegen</Button>
		</div>
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head class="hidden sm:table-cell">Kürzel</Table.Head>
						<Table.Head class="w-20"><span class="sr-only">Aktionen</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.tenants as tenant (tenant.id)}
						<Table.Row class={tenant.deletedAt ? 'text-muted-foreground' : ''}>
							<Table.Cell class="whitespace-normal">
								{#if tenant.deletedAt}
									<span class="font-medium">{tenant.name}</span>
									<Badge variant="secondary">gelöscht am {formatDate(tenant.deletedAt)}</Badge>
								{:else}
									<a href="/{tenant.slug}" class="font-medium hover:underline">{tenant.name}</a>
								{/if}
								<p class="text-sm text-muted-foreground sm:hidden">{tenant.slug}</p>
							</Table.Cell>
							<Table.Cell class="hidden sm:table-cell">{tenant.slug}</Table.Cell>
							<Table.Cell class="text-right">
								<RowActions
									name={tenant.name}
									onedit={() => tenantDialog.show(tenant)}
									actions={tenant.deletedAt
										? [
												{
													label: 'Wiederherstellen',
													icon: ArchiveRestoreIcon,
													onselect: () => restoreTenant(tenant)
												}
											]
										: [
												{
													label: 'Mitglieder',
													icon: UsersIcon,
													onselect: () => goto(`/${tenant.slug}/members`)
												},
												{
													label: 'Löschen',
													icon: Trash2Icon,
													destructive: true,
													onselect: () => removeTenant(tenant)
												}
											]}
								/>
							</Table.Cell>
						</Table.Row>
					{:else}
						<Table.Row>
							<Table.Cell colspan={3} class="py-8 text-center text-muted-foreground">
								Noch keine Stämme.
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>

	<section class="space-y-4">
		<div>
			<h2 class="text-2xl font-bold tracking-tight">Konten</h2>
			<p class="text-muted-foreground">
				Konten werden bei den Mitgliedern eines Stamms angelegt. Konten ohne Stamm bleiben, bis du
				sie löschst.
			</p>
		</div>
		<div class="rounded-md border">
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head class="hidden md:table-cell">Stämme</Table.Head>
						<Table.Head class="w-20"><span class="sr-only">Aktionen</span></Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each data.users as user (user.id)}
						{@const memberships = user.memberships.map(
							(m) => `${tenantNames.get(m.tenantId)} (${roleLabels[m.role]})`
						)}
						<Table.Row class={user.isDisabled ? 'text-muted-foreground' : ''}>
							<Table.Cell class="whitespace-normal">
								<span class="font-medium">{user.displayName}</span>
								{#if user.isPlatformAdmin}<Badge>Plattform-Admin</Badge>{/if}
								{#if user.setupPending}<Badge variant="outline">Einrichtung ausstehend</Badge>{/if}
								{#if user.isDisabled}<Badge variant="secondary">deaktiviert</Badge>{/if}
								{#if user.username}<p class="text-sm text-muted-foreground">{user.username}</p>{/if}
								<p class="text-sm md:hidden">{memberships.join(', ')}</p>
							</Table.Cell>
							<Table.Cell class="hidden whitespace-normal md:table-cell">
								{memberships.join(', ') || '—'}
							</Table.Cell>
							<Table.Cell class="text-right">
								<RowActions
									name={user.displayName}
									onedit={() => userDialog.show(user)}
									actions={[
										{
											label: 'Zu einem Stamm hinzufügen',
											icon: UserPlusIcon,
											onselect: () => membershipDialog.show(user)
										},
										...(user.username && !user.isDisabled
											? [
													{
														label: user.setupPending
															? 'Neuer Einrichtungslink'
															: 'Link zum Zurücksetzen des Passworts',
														icon: LinkIcon,
														onselect: () => newSetupLink(user)
													}
												]
											: []),
										{
											label: 'Löschen',
											icon: Trash2Icon,
											destructive: true,
											onselect: () => removeUser(user)
										}
									]}
								/>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>
		</div>
	</section>
</div>

<TenantDialog bind:this={tenantDialog} />
<UserDialog bind:this={userDialog} />
<MembershipDialog bind:this={membershipDialog} tenants={data.tenants} />
<SetupLinkDialog bind:this={setupLinkDialog} />
<ConfirmDelete bind:this={confirmDelete} />
