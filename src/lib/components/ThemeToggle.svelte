<script lang="ts">
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import SunIcon from '@lucide/svelte/icons/sun';
	import { setMode, userPrefersMode } from 'mode-watcher';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as DropdownMenu from '#lib/components/ui/dropdown-menu/index.js';

	// mode-watcher stores the choice in localStorage and follows the system setting for "system".
	const modes = [
		{ value: 'light', label: 'Hell', icon: SunIcon },
		{ value: 'dark', label: 'Dunkel', icon: MoonIcon },
		{ value: 'system', label: 'System', icon: MonitorIcon }
	] as const;
</script>

<DropdownMenu.Root>
	<DropdownMenu.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" aria-label="Farbschema" title="Farbschema">
				<SunIcon class="dark:hidden" />
				<MoonIcon class="hidden dark:block" />
			</Button>
		{/snippet}
	</DropdownMenu.Trigger>
	<DropdownMenu.Content align="end">
		<DropdownMenu.RadioGroup
			value={userPrefersMode.current}
			onValueChange={(value) => setMode(value as (typeof modes)[number]['value'])}
		>
			{#each modes as mode (mode.value)}
				<DropdownMenu.RadioItem value={mode.value}>
					<mode.icon />
					{mode.label}
				</DropdownMenu.RadioItem>
			{/each}
		</DropdownMenu.RadioGroup>
	</DropdownMenu.Content>
</DropdownMenu.Root>
