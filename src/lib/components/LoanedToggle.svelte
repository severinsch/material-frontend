<script lang="ts">
	import { settings } from '#lib/settings.svelte.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
</script>

<div class="flex items-center gap-2">
	<Switch id="subtract-loaned" bind:checked={settings.subtractLoaned} />
	<Label for="subtract-loaned">Ausgeliehenes nicht als verfügbar zählen</Label>
</div>
