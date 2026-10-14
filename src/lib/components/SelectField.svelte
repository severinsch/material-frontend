<script lang="ts" generics="T extends string">
	import * as Select from '#lib/components/ui/select/index.js';

	let {
		id,
		value = $bindable(),
		options,
		placeholder = 'Auswählen…'
	}: {
		id?: string;
		value: T;
		options: { value: T; label: string }[];
		placeholder?: string;
	} = $props();
</script>

<Select.Root type="single" bind:value>
	<Select.Trigger {id} class="w-full">
		{options.find((option) => option.value === value)?.label ?? placeholder}
	</Select.Trigger>
	<Select.Content>
		{#each options as option (option.value)}
			<Select.Item value={option.value}>{option.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
