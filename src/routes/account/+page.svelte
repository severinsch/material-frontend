<script lang="ts">
	import { api, mutate } from '#lib/api/index.js';
	import { roleLabels } from '#lib/permissions.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from '#lib/components/Field.svelte';

	let { data } = $props();
	const user = $derived(data.user!);

	// Initialized once; after saving, the form keeps what was typed (which is what was saved).
	// svelte-ignore state_referenced_locally
	let displayName = $state(data.user!.displayName);
	let passwords = $state({ current: '', new: '', repeated: '' });
	let saving = $state(false);

	const mismatch = $derived(passwords.repeated !== '' && passwords.new !== passwords.repeated);

	async function saveProfile(event: SubmitEvent) {
		event.preventDefault();
		saving = true;
		await mutate(api.PUT('/auth/me', { body: { displayName } }), 'Name gespeichert');
		saving = false;
	}

	async function changePassword(event: SubmitEvent) {
		event.preventDefault();
		if (mismatch) return;
		saving = true;
		const body = { currentPassword: passwords.current, newPassword: passwords.new };
		const changed = await mutate(
			api.PUT('/auth/me/password', { body }),
			'Passwort geändert. Auf anderen Geräten bist du jetzt abgemeldet.'
		);
		if (changed) passwords = { current: '', new: '', repeated: '' };
		saving = false;
	}
</script>

<svelte:head><title>Mein Konto – Materialverwaltung</title></svelte:head>

<div class="mx-auto max-w-lg space-y-6">
	<h1 class="text-2xl font-bold tracking-tight">Mein Konto</h1>

	<Card.Root>
		<Card.Header>
			<Card.Title>Name</Card.Title>
			{#if user.username}<Card.Description>Benutzername: {user.username}</Card.Description>{/if}
		</Card.Header>
		<Card.Content>
			<form class="flex gap-2" onsubmit={saveProfile}>
				<Input aria-label="Name" bind:value={displayName} required maxlength={255} />
				<Button type="submit" disabled={saving}>Speichern</Button>
			</form>
		</Card.Content>
	</Card.Root>

	{#if user.username}
		<Card.Root>
			<Card.Header>
				<Card.Title>Passwort ändern</Card.Title>
				<Card.Description>Danach bist du auf allen anderen Geräten abgemeldet.</Card.Description>
			</Card.Header>
			<Card.Content>
				<form class="grid gap-4" onsubmit={changePassword}>
					<input type="hidden" autocomplete="username" value={user.username} />
					<Field label="Aktuelles Passwort" id="current-password">
						<Input
							id="current-password"
							type="password"
							autocomplete="current-password"
							required
							bind:value={passwords.current}
						/>
					</Field>
					<Field label="Neues Passwort (mindestens 12 Zeichen)" id="new-password">
						<Input
							id="new-password"
							type="password"
							autocomplete="new-password"
							minlength={12}
							maxlength={200}
							required
							bind:value={passwords.new}
						/>
					</Field>
					<Field label="Neues Passwort wiederholen" id="repeated-password">
						<Input
							id="repeated-password"
							type="password"
							autocomplete="new-password"
							required
							aria-invalid={mismatch}
							bind:value={passwords.repeated}
						/>
					</Field>
					{#if mismatch}
						<p class="text-sm text-destructive">Die Passwörter stimmen nicht überein.</p>
					{/if}
					<Button type="submit" disabled={saving || mismatch}>Passwort ändern</Button>
				</form>
			</Card.Content>
		</Card.Root>
	{/if}

	<Card.Root>
		<Card.Header>
			<Card.Title>Meine Stämme</Card.Title>
		</Card.Header>
		<Card.Content>
			{#if user.tenants.length === 0}
				<p class="text-sm text-muted-foreground">Du gehörst noch zu keinem Stamm.</p>
			{:else}
				<ul class="divide-y text-sm">
					{#each user.tenants as tenant (tenant.id)}
						<li class="flex justify-between py-2">
							<a href="/{tenant.slug}" class="font-medium hover:underline">{tenant.name}</a>
							<span class="text-muted-foreground">
								{tenant.isMember ? roleLabels[tenant.role] : 'Als Plattform-Admin'}
							</span>
						</li>
					{/each}
				</ul>
			{/if}
		</Card.Content>
	</Card.Root>

	<form method="POST" action="/logout">
		<Button type="submit" variant="outline">Abmelden</Button>
	</form>
</div>
