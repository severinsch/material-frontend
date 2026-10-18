<script lang="ts">
	import { createTenantApi } from '#lib/api/index.js';
	import { hasPermission } from '#lib/permissions.js';
	import { setTenant } from '#lib/tenant.js';

	let { data, children } = $props();

	const api = $derived(createTenantApi(data.tenant.id));

	setTenant({
		get tenant() {
			return data.tenant;
		},
		get user() {
			return data.user;
		},
		get api() {
			return api;
		},
		href: (path) => `/${data.tenant.slug}${path}`,
		can: (permission) => hasPermission(data.tenant.role, permission)
	});
</script>

<svelte:head><title>{data.tenant.name} – Materialverwaltung</title></svelte:head>

{@render children()}
