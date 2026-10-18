<script lang="ts">
	import { api, mutate, type User } from '#lib/api/index.js';
	import { USERNAME_PATTERN } from '#lib/names.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	let open = $state(false);
	let user = $state<User | null>(null);
	let form = $state({ displayName: '', username: '', isPlatformAdmin: false, isDisabled: false });

	export function show(existing: User) {
		user = existing;
		form = {
			displayName: existing.displayName,
			username: existing.username ?? '',
			isPlatformAdmin: existing.isPlatformAdmin,
			isDisabled: existing.isDisabled
		};
		open = true;
	}

	function save() {
		const body = { ...form, username: user!.username ? form.username : null };
		return mutate(
			api.PUT('/users/{userId}', { params: { path: { userId: user!.id } }, body }),
			`${form.displayName} gespeichert`
		);
	}
</script>

<FormDialog bind:open title="{user?.displayName} bearbeiten" onsubmit={save}>
	<Field label="Name" id="user-name">
		<Input id="user-name" bind:value={form.displayName} required maxlength={255} />
	</Field>
	{#if user?.username}
		<Field label="Benutzername" id="user-username">
			<Input
				id="user-username"
				value={form.username}
				oninput={(event) => (form.username = event.currentTarget.value.toLowerCase())}
				required
				pattern={USERNAME_PATTERN}
				title="3 bis 100 Kleinbuchstaben, Ziffern, Punkt, Bindestrich oder Unterstrich"
				autocapitalize="none"
				autocomplete="off"
			/>
		</Field>
	{/if}
	<div class="flex items-start gap-2">
		<Checkbox id="user-platform-admin" bind:checked={form.isPlatformAdmin} />
		<div class="grid gap-1">
			<Label for="user-platform-admin">Plattform-Admin</Label>
			<p class="text-sm text-muted-foreground">
				Voller Zugriff auf alle Stämme und diese Verwaltung.
			</p>
		</div>
	</div>
	<div class="flex items-start gap-2">
		<Checkbox id="user-disabled" bind:checked={form.isDisabled} />
		<div class="grid gap-1">
			<Label for="user-disabled">Deaktiviert</Label>
			<p class="text-sm text-muted-foreground">
				Kann sich nicht anmelden; laufende Sitzungen enden.
			</p>
		</div>
	</div>
</FormDialog>
