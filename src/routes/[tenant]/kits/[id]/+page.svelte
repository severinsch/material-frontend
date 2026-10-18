<script lang="ts">
	import KitForm from '#lib/components/KitForm.svelte';

	let { data } = $props();
</script>

<h1 class="mb-4 text-2xl font-bold tracking-tight">{data.kit.name} bearbeiten</h1>
{#key data.kit.id}
	<KitForm kit={data.kit} materials={data.materials} />
{/key}
