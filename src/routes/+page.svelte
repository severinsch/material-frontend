<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
	import { roleLabels } from '#lib/permissions.js';
	import * as Alert from '#lib/components/ui/alert/index.js';
	import * as Card from '#lib/components/ui/card/index.js';

	let { data } = $props();
	const user = $derived(data.user!);
</script>

<svelte:head><title>Materialverwaltung</title></svelte:head>

<div class="mx-auto max-w-md space-y-4">
	{#if data.lostAccess}
		<Alert.Root>
			<Alert.Description>
				Diesen Stamm gibt es nicht, oder du hast keinen Zugriff (mehr) darauf. Vielleicht hat sich
				auch seine Adresse geändert.
			</Alert.Description>
		</Alert.Root>
	{/if}

	{#if user.tenants.length === 0}
		<Card.Root>
			<Card.Header>
				<Card.Title>Noch kein Zugriff</Card.Title>
				<Card.Description>
					{user.isPlatformAdmin
						? 'Es gibt noch keinen Stamm. Leg in der Verwaltung den ersten an.'
						: 'Dein Konto gehört noch zu keinem Stamm. Frag die Admins deines Stamms, ob sie dich hinzufügen.'}
				</Card.Description>
			</Card.Header>
			{#if user.isPlatformAdmin}
				<Card.Content>
					<a href="/admin" class="text-sm underline underline-offset-4">Zur Verwaltung</a>
				</Card.Content>
			{/if}
		</Card.Root>
	{:else}
		<h1 class="text-2xl font-bold tracking-tight">Stamm auswählen</h1>
		<div class="grid gap-2">
			{#each user.tenants as tenant (tenant.id)}
				<a
					href="/{tenant.slug}"
					class="flex items-center justify-between rounded-md border p-4 transition-colors hover:bg-muted/50"
				>
					<span>
						<span class="block font-medium">{tenant.name}</span>
						<span class="text-sm text-muted-foreground">
							{tenant.isMember ? roleLabels[tenant.role] : 'Als Plattform-Admin'}
						</span>
					</span>
					<ChevronRightIcon class="size-4 text-muted-foreground" />
				</a>
			{/each}
		</div>
	{/if}
</div>
