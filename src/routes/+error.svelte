<script lang="ts">
	import { page } from '$app/state';
	import * as Alert from '#lib/components/ui/alert/index.js';
</script>

<Alert.Root variant="destructive">
	<Alert.Title>Fehler {page.status}</Alert.Title>
	<Alert.Description>{page.error?.message}</Alert.Description>
</Alert.Root>
