<script lang="ts">
	import { mutate, type Member, type SetupLink, type TenantRole } from '#lib/api/index.js';
	import { roleDescriptions, roleLabels } from '#lib/permissions.js';
	import { getTenant } from '#lib/tenant.js';
	import { suggestUsername, USERNAME_PATTERN } from '#lib/names.js';
	import { optionsOf } from '#lib/format.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';
	import SelectField from './SelectField.svelte';

	let { oncreated }: { oncreated: (member: Member, setupLink: SetupLink) => void } = $props();

	const tenant = getTenant();
	const api = $derived(tenant.api);

	let open = $state(false);
	let member = $state<Member | null>(null);
	let form = $state({ displayName: '', username: '', role: 'VIEWER' as TenantRole });
	/** Whether the username was typed, so it no longer follows the name. */
	let usernameTouched = $state(false);

	/** Opens the dialog to edit [existing], or to create a new account. */
	export function show(existing?: Member) {
		member = existing ?? null;
		form = {
			displayName: existing?.displayName ?? '',
			username: existing?.username ?? '',
			role: existing?.role ?? 'VIEWER'
		};
		usernameTouched = existing !== undefined;
		open = true;
	}

	function save() {
		if (member) {
			const body = {
				role: form.role,
				displayName: form.displayName,
				username: member.username ? form.username : null
			};
			return mutate(
				api.PUT('/members/{userId}', { params: { path: { userId: member.userId } }, body }),
				`${form.displayName} gespeichert`
			);
		}
		return mutate(api.POST('/members', { body: form }), `Konto für ${form.displayName} angelegt`, {
			onSuccess: (created) => oncreated(created.member, created.setupLink)
		});
	}
</script>

<FormDialog
	bind:open
	title={member ? `${member.displayName} bearbeiten` : 'Konto anlegen'}
	description={member
		? undefined
		: 'Danach bekommst du einen Link, mit dem die Person ihr Passwort festlegt.'}
	submitLabel={member ? 'Speichern' : 'Anlegen'}
	onsubmit={save}
>
	<Field label="Name" id="member-name">
		<Input
			id="member-name"
			bind:value={form.displayName}
			oninput={() => {
				if (!usernameTouched) form.username = suggestUsername(form.displayName);
			}}
			required
			maxlength={255}
		/>
	</Field>
	{#if !member || member.username}
		<Field label="Benutzername" id="member-username">
			<Input
				id="member-username"
				value={form.username}
				oninput={(event) => {
					usernameTouched = true;
					form.username = event.currentTarget.value.toLowerCase();
				}}
				required
				pattern={USERNAME_PATTERN}
				title="3 bis 100 Kleinbuchstaben, Ziffern, Punkt, Bindestrich oder Unterstrich"
				autocapitalize="none"
				autocomplete="off"
			/>
		</Field>
	{/if}
	<Field label="Rolle" id="member-role">
		<SelectField id="member-role" bind:value={form.role} options={optionsOf(roleLabels)} />
		<p class="text-sm text-muted-foreground">{roleDescriptions[form.role]}</p>
	</Field>
</FormDialog>
