<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchIcon from '@lucide/svelte/icons/search';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { api, mutate, type Material } from '#lib/api/index.js';
	import { trackingTypeLabels } from '#lib/format.js';
	import { availableNow } from '#lib/settings.svelte.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';
	import MaterialDialog from '#lib/components/MaterialDialog.svelte';

	let { data } = $props();

	let query = $state('');
	let materialDialog: MaterialDialog;
	let confirmDelete: ConfirmDelete;

	const materials = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return data.materials.filter((material) =>
			[material.name, material.category, material.description].some((text) =>
				text?.toLowerCase().includes(q)
			)
		);
	});

	function remove(material: Material) {
		confirmDelete.show(`material "${material.name}"`, () =>
			mutate(
				api.DELETE('/materials/{id}', { params: { path: { id: material.id } } }),
				`Deleted ${material.name}`
			)
		);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Materials</h1>
		<Button onclick={() => materialDialog.show()}><PlusIcon />Add material</Button>
	</div>

	<div class="flex flex-col gap-4 sm:flex-row sm:items-center">
		<div class="relative flex-1">
			<SearchIcon class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
			<Input
				type="search"
				placeholder="Search name, category, description…"
				class="pl-9"
				bind:value={query}
			/>
		</div>
		<LoanedToggle />
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Name</Table.Head>
					<Table.Head class="hidden md:table-cell">Category</Table.Head>
					<Table.Head class="hidden md:table-cell">Tracking</Table.Head>
					<Table.Head class="text-right">Available</Table.Head>
					<Table.Head class="hidden text-right sm:table-cell">Damaged</Table.Head>
					<Table.Head class="hidden text-right sm:table-cell">Lent out</Table.Head>
					<Table.Head class="w-20"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each materials as material (material.id)}
					<Table.Row>
						<Table.Cell class="whitespace-normal">
							<a href="/materials/{material.id}" class="font-medium hover:underline"
								>{material.name}</a
							>
							{#if material.description}
								<p class="text-sm text-muted-foreground">{material.description}</p>
							{/if}
						</Table.Cell>
						<Table.Cell class="hidden md:table-cell">
							{#if material.category}<Badge variant="outline">{material.category}</Badge>{/if}
						</Table.Cell>
						<Table.Cell class="hidden text-muted-foreground md:table-cell">
							{trackingTypeLabels[material.trackingType]}
						</Table.Cell>
						<Table.Cell class="text-right tabular-nums">{availableNow(material)}</Table.Cell>
						<Table.Cell class="hidden text-right tabular-nums sm:table-cell"
							>{material.damagedCount}</Table.Cell
						>
						<Table.Cell class="hidden text-right tabular-nums sm:table-cell"
							>{material.loanedCount}</Table.Cell
						>
						<Table.Cell class="text-right">
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit"
								onclick={() => materialDialog.show(material)}
							>
								<PencilIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Delete"
								onclick={() => remove(material)}
							>
								<Trash2Icon />
							</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={7} class="py-8 text-center text-muted-foreground">
							{query ? `No materials match "${query}".` : 'No materials yet.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<MaterialDialog bind:this={materialDialog} locations={data.locations} />
<ConfirmDelete bind:this={confirmDelete} />
