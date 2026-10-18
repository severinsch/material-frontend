<script lang="ts">
	import { onMount } from 'svelte';
	import { deserialize, enhance } from '$app/forms';
	import type { SetupInfo } from '#lib/api/index.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from '#lib/components/Field.svelte';

	let { form } = $props();

	let token = $state('');
	let info = $state<SetupInfo | null>(null);
	let problem = $state<string | null>(null);
	let password = $state('');
	let repeated = $state('');
	let submitting = $state(false);

	const mismatch = $derived(repeated !== '' && password !== repeated);

	onMount(async () => {
		// Tokens are base64url, so they need no decoding.
		token = location.hash.slice(1);
		if (!token) {
			problem =
				'Der Link ist unvollständig. Kopiere ihn noch einmal vollständig aus der Nachricht.';
			return;
		}
		const body = new FormData();
		body.set('token', token);
		try {
			const response = await fetch('?/inspect', {
				method: 'POST',
				body,
				headers: { accept: 'application/json', 'x-sveltekit-action': 'true' }
			});
			const result = deserialize(await response.text());
			if (result.type === 'success') info = (result.data as { info: SetupInfo }).info;
			else if (result.type === 'failure') problem = (result.data as { message: string }).message;
			else problem = 'Der Link konnte nicht geprüft werden.';
		} catch {
			problem = 'Der Link konnte nicht geprüft werden.';
		}
	});
</script>

<svelte:head><title>Passwort festlegen – Materialverwaltung</title></svelte:head>

<Card.Root class="mx-auto mt-8 max-w-sm">
	<Card.Header>
		<Card.Title>Passwort festlegen</Card.Title>
		{#if info}
			<Card.Description>
				Hallo {info.displayName}, dein Benutzername ist <strong>{info.username}</strong>.
			</Card.Description>
		{/if}
	</Card.Header>
	<Card.Content>
		{#if problem}
			<Alert.Root variant="destructive">
				<Alert.Description>
					{problem} Frag die Admins deines Stamms nach einem neuen Link.
				</Alert.Description>
			</Alert.Root>
		{:else if info}
			<form
				method="POST"
				action="?/complete"
				class="grid gap-4"
				use:enhance={({ cancel }) => {
					if (mismatch) return cancel();
					submitting = true;
					return async ({ update }) => {
						await update({ reset: false });
						submitting = false;
					};
				}}
			>
				{#if form?.message}
					<Alert.Root variant="destructive">
						<Alert.Description>{form.message}</Alert.Description>
					</Alert.Root>
				{/if}
				<input type="hidden" name="token" value={token} />
				<!-- Lets password managers store the password for the right account. -->
				<input type="hidden" name="username" autocomplete="username" value={info.username} />
				<Field label="Neues Passwort (mindestens 12 Zeichen)" id="password">
					<Input
						id="password"
						name="password"
						type="password"
						autocomplete="new-password"
						minlength={12}
						maxlength={200}
						required
						bind:value={password}
					/>
				</Field>
				<Field label="Passwort wiederholen" id="repeated">
					<Input
						id="repeated"
						type="password"
						autocomplete="new-password"
						required
						aria-invalid={mismatch}
						bind:value={repeated}
					/>
				</Field>
				{#if mismatch}
					<p class="text-sm text-destructive">Die Passwörter stimmen nicht überein.</p>
				{/if}
				<Button type="submit" disabled={submitting || mismatch}
					>Passwort speichern und anmelden</Button
				>
			</form>
		{:else}
			<p class="text-sm text-muted-foreground">Link wird geprüft…</p>
		{/if}
	</Card.Content>
</Card.Root>
