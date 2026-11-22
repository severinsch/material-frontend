<!-- Where the person is entering: one collapsed line, since it rarely changes; applies to every following entry. -->
<script lang="ts">
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import type { StorageLocation } from '#lib/api/index.js';
	import SelectField from '#lib/components/SelectField.svelte';
	import { Input } from '#lib/components/ui/input/index.js';
	import { locationOptions } from '#lib/format.js';
	import type { QuickSession } from './session.svelte.js';

	let {
		session,
		locations,
		phone = false
	}: { session: QuickSession; locations: StorageLocation[]; phone?: boolean } = $props();

	// Open by itself once per visit while no location is chosen, so it isn't forgotten for a whole shelf.
	let open = $state(initiallyOpen());

	function initiallyOpen() {
		const ask = !session.locationAsked && locations.length > 0 && !session.locationId;
		session.locationAsked = true;
		return ask;
	}
	const options = $derived(locationOptions(locations));
	const location = $derived(locations.find((l) => l.id === session.locationId));
</script>

<div class="text-sm">
	<button
		type="button"
		class="flex max-w-full items-center gap-1.5 rounded-md py-1 text-left text-muted-foreground hover:text-foreground"
		aria-expanded={open}
		onclick={() => (open = !open)}
	>
		<MapPinIcon class="size-4 shrink-0" />
		<span class="truncate">
			<span class="font-medium text-foreground">{location?.name ?? 'Kein Lagerort'}</span
			>{#if session.place.trim()}
				· {session.place}{/if}
		</span>
		<span class="shrink-0 text-primary">{open ? 'fertig' : 'ändern'}</span>
	</button>
	{#if open}
		<div class={['mt-1 mb-2 gap-2', phone ? 'grid' : 'flex flex-wrap items-center']}>
			<div class={phone ? '' : 'w-52'}>
				<SelectField bind:value={session.locationId} {options} label="Lagerort" />
			</div>
			<Input
				bind:value={session.place}
				placeholder="Platz, z. B. Regal links (optional)"
				aria-label="Platz im Lagerort"
				maxlength={255}
				class={phone ? 'h-10' : 'w-72'}
			/>
		</div>
	{/if}
</div>
