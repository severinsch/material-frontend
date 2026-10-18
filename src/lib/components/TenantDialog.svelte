<script lang="ts">
	import { page } from '$app/state';
	import { api, mutate, type Tenant } from '#lib/api/index.js';
	import { SLUG_PATTERN, suggestSlug } from '#lib/names.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import Field from './Field.svelte';
	import FormDialog from './FormDialog.svelte';

	let open = $state(false);
	let tenant = $state<Tenant | null>(null);
	let form = $state({ name: '', slug: '' });
	/** Whether the slug was typed, so it no longer follows the name. */
	let slugTouched = $state(false);

	/** Opens the dialog to edit [existing], or to create a new tenant. */
	export function show(existing?: Tenant) {
		tenant = existing ?? null;
		form = { name: existing?.name ?? '', slug: existing?.slug ?? '' };
		slugTouched = existing !== undefined;
		open = true;
	}

	function save() {
		const request = tenant
			? api.PUT('/tenants/{tenantId}', { params: { path: { tenantId: tenant.id } }, body: form })
			: api.POST('/tenants', { body: form });
		return mutate(request, `${form.name} gespeichert`);
	}
</script>

<FormDialog
	bind:open
	title={tenant ? `${tenant.name} bearbeiten` : 'Stamm anlegen'}
	submitLabel={tenant ? 'Speichern' : 'Anlegen'}
	onsubmit={save}
>
	<Field label="Name" id="tenant-name">
		<Input
			id="tenant-name"
			bind:value={form.name}
			oninput={() => {
				if (!slugTouched) form.slug = suggestSlug(form.name);
			}}
			required
			maxlength={100}
			placeholder="z. B. Stamm Langenbach"
		/>
	</Field>
	<Field label="Kürzel für die Adresse" id="tenant-slug">
		<Input
			id="tenant-slug"
			value={form.slug}
			oninput={(event) => {
				slugTouched = true;
				form.slug = event.currentTarget.value.toLowerCase();
			}}
			required
			maxlength={50}
			pattern={SLUG_PATTERN}
			title="Kleinbuchstaben und Ziffern, mit einzelnen Bindestrichen dazwischen"
			autocapitalize="none"
		/>
		<p class="text-sm text-muted-foreground">
			{page.url.host}/{form.slug || '…'}
			{#if tenant && form.slug !== tenant.slug}
				<br /><strong>Bisherige Links auf diesen Stamm funktionieren danach nicht mehr.</strong>
			{/if}
		</p>
	</Field>
</FormDialog>
