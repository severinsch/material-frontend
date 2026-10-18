<script lang="ts">
	import * as Alert from '#lib/components/ui/alert/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from '#lib/components/Field.svelte';

	let { form } = $props();
</script>

<svelte:head><title>Anmelden – Materialverwaltung</title></svelte:head>

<Card.Root class="mx-auto mt-8 max-w-sm">
	<Card.Header>
		<Card.Title>Anmelden</Card.Title>
	</Card.Header>
	<Card.Content>
		<!-- Not enhanced: password managers reliably recognize a plain form submission as a login. -->
		<form method="POST" class="grid gap-4">
			{#if form?.message}
				<Alert.Root variant="destructive">
					<Alert.Description>{form.message}</Alert.Description>
				</Alert.Root>
			{/if}
			<Field label="Benutzername" id="username">
				<Input
					id="username"
					name="username"
					type="text"
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
			<Button type="submit">Anmelden</Button>
			<p class="text-sm text-muted-foreground">
				Noch kein Konto oder Passwort vergessen? Frag die Admins deines Stamms nach einem Link.
			</p>
		</form>
	</Card.Content>
</Card.Root>
