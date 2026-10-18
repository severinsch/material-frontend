<script lang="ts">
	import { enhance } from '$app/forms';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from '#lib/components/Field.svelte';

	let { form } = $props();
	let submitting = $state(false);
</script>

<svelte:head><title>Anmelden – Materialverwaltung</title></svelte:head>

<Card.Root class="mx-auto mt-8 max-w-sm">
	<Card.Header>
		<Card.Title>Anmelden</Card.Title>
	</Card.Header>
	<Card.Content>
		<form
			method="POST"
			class="grid gap-4"
			use:enhance={() => {
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
			<Field label="Benutzername" id="username">
				<Input
					id="username"
					name="username"
					value={form?.username ?? ''}
					autocomplete="username"
					autocapitalize="none"
					required
				/>
			</Field>
			<Field label="Passwort" id="password">
				<Input
					id="password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
				/>
			</Field>
			<Button type="submit" disabled={submitting}>Anmelden</Button>
			<p class="text-sm text-muted-foreground">
				Noch kein Konto oder Passwort vergessen? Frag die Admins deines Stamms nach einem Link.
			</p>
		</form>
	</Card.Content>
</Card.Root>
