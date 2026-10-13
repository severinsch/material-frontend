<script lang="ts">
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { toast } from 'svelte-sonner';
	import { api, mutate, type Kit, type Material, type NewKit } from '#lib/api/index.js';
	import { orNull } from '#lib/format.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import ConfirmDelete from './ConfirmDelete.svelte';
	import Field from './Field.svelte';
	import SelectField from './SelectField.svelte';

	let { kit, materials }: { kit?: Kit; materials: Material[] } = $props();

	// The form is created once per kit; the page re-creates this component when navigating to another kit.
	// svelte-ignore state_referenced_locally
	const form = $state({
		name: kit?.name ?? '',
		description: kit?.description ?? '',
		groups: (kit?.groups ?? []).map((group) => ({
			name: group.name ?? '',
			requiredUnits: group.requiredUnits,
			isOptional: group.isOptional,
			// Options are kept in priority order, the first one is used first.
			options: group.options
				.toSorted((a, b) => a.priority - b.priority)
				.map(({ materialId, unitValue }) => ({ materialId, unitValue }))
		}))
	});
	let saving = $state(false);
	let confirmDelete: ConfirmDelete;

	const materialOptions = $derived(
		materials
			.map((m) => ({ value: m.id, label: m.name }))
			.sort((a, b) => a.label.localeCompare(b.label))
	);

	function newOption() {
		return { materialId: '', unitValue: 1 };
	}

	function moveUp<T>(list: T[], index: number) {
		[list[index - 1], list[index]] = [list[index], list[index - 1]];
	}

	async function save(event: SubmitEvent) {
		event.preventDefault();
		if (form.groups.some((group) => group.options.some((option) => !option.materialId))) {
			toast.error('Choose a material for every option.');
			return;
		}
		const body: NewKit = {
			name: form.name,
			description: orNull(form.description),
			groups: form.groups.map((group) => ({
				...group,
				name: orNull(group.name),
				options: group.options.map((option, priority) => ({ ...option, priority }))
			}))
		};
		saving = true;
		const request = kit
			? api.PUT('/kits/{id}', { params: { path: { id: kit.id } }, body })
			: api.POST('/kits', { body });
		await mutate(request, `Saved ${form.name}`, '/kits');
		saving = false;
	}

	function remove(kit: Kit) {
		confirmDelete.show(`kit "${kit.name}"`, () =>
			mutate(
				api.DELETE('/kits/{id}', { params: { path: { id: kit.id } } }),
				`Deleted ${kit.name}`,
				'/kits'
			)
		);
	}
</script>

<form onsubmit={save} class="max-w-3xl space-y-6">
	<div class="grid gap-4">
		<Field label="Name" id="kit-name">
			<Input
				id="kit-name"
				bind:value={form.name}
				required
				maxlength={255}
				placeholder="e.g. Jurte"
			/>
		</Field>
		<Field label="Description" id="kit-description">
			<Input id="kit-description" bind:value={form.description} />
		</Field>
	</div>

	<div class="space-y-2">
		<h2 class="text-lg font-semibold">Parts</h2>
		<p class="text-sm text-muted-foreground">
			Each part needs a number of units, filled by one or more interchangeable materials. Materials
			are used in the listed order; a material can count as several units (e.g. a half roof replaces
			three tent sheets). Optional parts are packed completely or not at all.
		</p>
	</div>

	{#each form.groups as group, g (group)}
		<Card.Root>
			<Card.Content class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-[1fr_8rem_auto] sm:items-end">
					<Field label="Name (optional)" id="group-{g}-name">
						<Input id="group-{g}-name" bind:value={group.name} placeholder="e.g. Roof" />
					</Field>
					<Field label="Units" id="group-{g}-units">
						<Input
							id="group-{g}-units"
							type="number"
							min={1}
							required
							bind:value={group.requiredUnits}
						/>
					</Field>
					<div class="flex h-9 items-center gap-2">
						<Checkbox id="group-{g}-optional" bind:checked={group.isOptional} />
						<Label for="group-{g}-optional">Optional</Label>
					</div>
				</div>

				<div class="space-y-2">
					{#each group.options as option, o (option)}
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<SelectField
									bind:value={option.materialId}
									options={materialOptions}
									placeholder="Material…"
								/>
							</div>
							<Input
								type="number"
								min={1}
								required
								class="w-20"
								aria-label="Units per piece"
								title="Units per piece"
								bind:value={option.unitValue}
							/>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Use earlier"
								disabled={o === 0}
								onclick={() => moveUp(group.options, o)}
							>
								<ArrowUpIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Remove material"
								disabled={group.options.length === 1}
								onclick={() => group.options.splice(o, 1)}
							>
								<XIcon />
							</Button>
						</div>
					{/each}
				</div>
			</Card.Content>
			<Card.Footer class="justify-between">
				<Button variant="outline" size="sm" onclick={() => group.options.push(newOption())}>
					<PlusIcon />Alternative material
				</Button>
				<div class="flex gap-1">
					<Button
						variant="ghost"
						size="sm"
						disabled={g === 0}
						onclick={() => moveUp(form.groups, g)}
					>
						<ArrowUpIcon />Move up
					</Button>
					<Button variant="ghost" size="sm" onclick={() => form.groups.splice(g, 1)}>
						<XIcon />Remove part
					</Button>
				</div>
			</Card.Footer>
		</Card.Root>
	{/each}

	<Button
		variant="outline"
		onclick={() =>
			form.groups.push({ name: '', requiredUnits: 1, isOptional: false, options: [newOption()] })}
	>
		<PlusIcon />Add part
	</Button>

	<div class="flex justify-between border-t pt-4">
		<div class="flex gap-2">
			<Button type="submit" disabled={saving}>Save kit</Button>
			<Button variant="outline" href="/kits">Cancel</Button>
		</div>
		{#if kit}
			<Button variant="destructive" onclick={() => remove(kit)}>Delete kit</Button>
		{/if}
	</div>
</form>

<ConfirmDelete bind:this={confirmDelete} />
