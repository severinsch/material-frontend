<script lang="ts">
	import CopyIcon from '@lucide/svelte/icons/copy';
	import { toast } from 'svelte-sonner';
	import type { SetupLink } from '#lib/api/index.js';
	import { formatDateTime } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';

	let open = $state(false);
	let name = $state('');
	let link = $state('');
	let expiresAt = $state('');

	/** Shows the setup link for the account of [displayName], to pass on. */
	export function show(displayName: string, setupLink: SetupLink) {
		name = displayName;
		// The token goes into the fragment, which browsers never send to servers (see routes/setup).
		link = `${location.origin}/setup#${setupLink.token}`;
		expiresAt = setupLink.expiresAt;
		open = true;
	}

	async function copy() {
		try {
			await navigator.clipboard.writeText(link);
			toast.success('Link kopiert');
		} catch {
			toast.error('Kopieren geht nur über HTTPS. Markiere den Link und kopiere ihn von Hand.');
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Einrichtungslink für {name}</Dialog.Title>
			<Dialog.Description>
				Gib den Link nur an {name} weiter: Wer ihn öffnet, legt das Passwort für dieses Konto fest. Er
				funktioniert einmal und ist gültig bis {expiresAt && formatDateTime(expiresAt)}.
			</Dialog.Description>
		</Dialog.Header>
		<div class="flex gap-2">
			<Input
				readonly
				value={link}
				aria-label="Einrichtungslink"
				onfocus={(event) => event.currentTarget.select()}
			/>
			<Button variant="outline" onclick={copy}><CopyIcon />Kopieren</Button>
		</div>
		<Dialog.Footer>
			<Button onclick={() => (open = false)}>Fertig</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
