<script lang="ts" generics="T extends string">
	import * as Select from '#lib/components/ui/select/index.js';

	let {
		id,
		value = $bindable(),
		options,
		placeholder = 'Auswählen…',
		invalid = false,
		describedby
	}: {
		id?: string;
		value: T;
		options: { value: T; label: string }[];
		placeholder?: string;
		/** Marks the field as invalid, e.g. when a required choice is missing. */
		invalid?: boolean;
		/** The id of the element that describes the field, e.g. its error message. */
		describedby?: string;
	} = $props();
</script>

<Select.Root type="single" bind:value>
	<Select.Trigger
		{id}
		class="w-full"
		aria-invalid={invalid || undefined}
		aria-describedby={describedby}
	>
		{options.find((option) => option.value === value)?.label ?? placeholder}
	</Select.Trigger>
	<Select.Content>
		{#each options as option (option.value)}
			<Select.Item value={option.value}>{option.label}</Select.Item>
		{/each}
	</Select.Content>
</Select.Root>
