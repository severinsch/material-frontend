<script lang="ts">
	import { api, mutate, type Tenant, type TenantRole, type User } from '#lib/api/index.js';
	import { optionsOf } from '#lib/format.js';
	import { roleDescriptions, roleLabels } from '#lib/permissions.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	let { tenants }: { tenants: Tenant[] } = $props();

	let open = $state(false);
	let user = $state<User | null>(null);
	let form = $state({ tenantId: '', role: 'VIEWER' as TenantRole });

	/** Tenants [user] could be added to. */
	const options = $derived(
		tenants
			.filter(
				(tenant) => !tenant.deletedAt && !user?.memberships.some((m) => m.tenantId === tenant.id)
			)
			.map((tenant) => ({ value: tenant.id, label: tenant.name }))
	);

	/** Opens the dialog to add [existing] to a tenant, e.g. someone who helps out in a second Stamm. */
	export function show(existing: User) {
		user = existing;
		form = { tenantId: '', role: 'VIEWER' };
		open = true;
	}

	async function save() {
		if (!form.tenantId) return false;
		const tenant = tenants.find((t) => t.id === form.tenantId)!;
		return mutate(
			api.PUT('/tenants/{tenantId}/members/{userId}', {
				params: { path: { tenantId: form.tenantId, userId: user!.id } },
				body: { role: form.role }
			}),
			`${user!.displayName} ist jetzt in ${tenant.name}`
		);
	}
</script>

<FormDialog bind:open title="{user?.displayName} zu einem Stamm hinzufügen" onsubmit={save}>
	<Field label="Stamm" id="membership-tenant">
		<SelectField id="membership-tenant" bind:value={form.tenantId} {options} />
	</Field>
	<Field label="Rolle" id="membership-role">
		<SelectField id="membership-role" bind:value={form.role} options={optionsOf(roleLabels)} />
		<p class="text-sm text-muted-foreground">{roleDescriptions[form.role]}</p>
	</Field>
</FormDialog>
