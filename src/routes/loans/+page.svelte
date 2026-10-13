<script lang="ts">
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UndoIcon from '@lucide/svelte/icons/undo-2';
	import { api, mutate, type Loan } from '#lib/api/index.js';
	import { formatDate, today } from '#lib/format.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import LoanDialog from '#lib/components/LoanDialog.svelte';

	let { data } = $props();

	let loanDialog: LoanDialog;
	let confirmDelete: ConfirmDelete;

	const materialNames = $derived(new Map(data.materials.map((m) => [m.id, m.name])));
	const items = $derived(new Map(data.items.map((item) => [item.id, item])));

	function contents(loan: Loan) {
		const lentItems = loan.itemIds.map((id) => {
			const item = items.get(id);
			return item ? `${materialNames.get(item.materialId)} ${item.identifier}` : 'Unknown item';
		});
		const lentBulk = loan.bulkMaterials.map(
			(line) => `${line.quantity}× ${materialNames.get(line.materialId)}`
		);
		return [...lentItems, ...lentBulk].join(', ');
	}

	function markReturned({ id, ...loan }: Loan) {
		const body = { ...loan, returnedAt: today() };
		return mutate(
			api.PUT('/loans/{id}', { params: { path: { id } }, body }),
			`${loan.borrower} returned everything`
		);
	}

	function remove(loan: Loan) {
		confirmDelete.show(`loan to ${loan.borrower}`, () =>
			mutate(api.DELETE('/loans/{id}', { params: { path: { id: loan.id } } }), 'Deleted loan')
		);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Loans</h1>
		<Button onclick={() => loanDialog.show()}><PlusIcon />Lend material</Button>
	</div>

	<div class="flex gap-2">
		<Button size="sm" variant={data.showAll ? 'outline' : 'secondary'} href="/loans">Open</Button>
		<Button size="sm" variant={data.showAll ? 'secondary' : 'outline'} href="/loans?all">All</Button
		>
	</div>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Borrower</Table.Head>
					<Table.Head>Material</Table.Head>
					<Table.Head class="hidden sm:table-cell">Lent</Table.Head>
					<Table.Head class="hidden sm:table-cell">Due / returned</Table.Head>
					<Table.Head class="w-28"></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.loans as loan (loan.id)}
					{@const overdue = !loan.returnedAt && loan.dueAt && loan.dueAt < today()}
					<Table.Row>
						<Table.Cell class="whitespace-normal">
							<span class="font-medium">{loan.borrower}</span>
							{#if loan.note}<p class="text-sm text-muted-foreground">{loan.note}</p>{/if}
						</Table.Cell>
						<Table.Cell class="whitespace-normal">{contents(loan)}</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">{formatDate(loan.lentAt)}</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">
							{#if loan.returnedAt}
								<Badge variant="secondary">returned {formatDate(loan.returnedAt)}</Badge>
							{:else if overdue}
								<Badge variant="destructive">overdue since {formatDate(loan.dueAt)}</Badge>
							{:else}
								{formatDate(loan.dueAt)}
							{/if}
						</Table.Cell>
						<Table.Cell class="text-right">
							{#if !loan.returnedAt}
								<Button
									variant="ghost"
									size="icon-sm"
									aria-label="Returned today"
									title="Returned today"
									onclick={() => markReturned(loan)}
								>
									<UndoIcon />
								</Button>
							{/if}
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Edit"
								onclick={() => loanDialog.show(loan)}
							>
								<PencilIcon />
							</Button>
							<Button
								variant="ghost"
								size="icon-sm"
								aria-label="Delete"
								onclick={() => remove(loan)}
							>
								<Trash2Icon />
							</Button>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="py-8 text-center text-muted-foreground">
							{data.showAll ? 'No loans yet.' : 'Nothing is lent out.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<LoanDialog bind:this={loanDialog} materials={data.materials} items={data.items} />
<ConfirmDelete bind:this={confirmDelete} />
