<!-- One line of fixed height: what saving does, or what's missing. -->
<script lang="ts">
	import { compactList } from '#lib/quick-entry.js';
	import type { Plan } from './session.svelte.js';

	let {
		plan,
		name,
		hint = null,
		center = false
	}: {
		plan: Plan;
		name: string;
		/** What the person may have meant instead of a new material, see `countAtEnd`. */
		hint?: string | null;
		center?: boolean;
	} = $props();

	const text = $derived.by(() => {
		if (plan.problem !== null) return plan.problem;
		const { match } = plan;
		if (match.kind !== 'existing') {
			const created = `Neues Material „${name.trim()}“`;
			return hint ? `${created} · Anzahl vorn: „${hint}“?` : created;
		}
		const label = match.variant.name
			? `${match.material.name} ${match.variant.name}`
			: match.material.name;
		if (plan.kind === 'BULK') {
			return `${label}: Bestand ${match.variant.availableCount} → ${match.variant.availableCount + plan.count}`;
		}
		return plan.taken.length
			? `${label}: ${compactList(plan.taken)} + ${compactList(plan.identifiers)}`
			: `${label}: ${compactList(plan.identifiers)}`;
	});
</script>

<p
	class={[
		'h-5 truncate text-xs',
		center && 'text-center',
		plan.problem ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground'
	]}
	aria-live={plan.problem ? 'polite' : 'off'}
>
	{text}
</p>
