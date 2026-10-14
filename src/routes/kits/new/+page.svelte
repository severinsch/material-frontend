<script lang="ts">
	import KitForm from '#lib/components/KitForm.svelte';

	let { data } = $props();
</script>

<h1 class="mb-4 text-2xl font-bold tracking-tight">Neues Set</h1>
<KitForm materials={data.materials} />
