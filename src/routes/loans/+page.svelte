<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { api, mutate, type Loan } from '#lib/api/index.js';
	import { formatDate, today } from '#lib/format.js';
	import { isOverdue, loanContents } from '#lib/loans.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Table from '#lib/components/ui/table/index.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import LoanDialog from '#lib/components/LoanDialog.svelte';
	import RowActions from '#lib/components/RowActions.svelte';

	let { data } = $props();

	let loanDialog: LoanDialog;
	let confirmDelete: ConfirmDelete;

	const materials = $derived(new Map(data.materials.map((m) => [m.id, m])));
	const items = $derived(new Map(data.items.map((item) => [item.id, item])));

	function markReturned({ id, ...loan }: Loan) {
		const setReturnedAt = (returnedAt: string | null) =>
			api.PUT('/loans/{id}', { params: { path: { id } }, body: { ...loan, returnedAt } });
		return mutate(setReturnedAt(today()), `${loan.borrower} hat alles zurückgegeben`, {
			undo: () => setReturnedAt(null)
		});
	}

	function remove(loan: Loan) {
		confirmDelete.show(`Ausleihe an ${loan.borrower}`, () =>
			mutate(api.DELETE('/loans/{id}', { params: { path: { id: loan.id } } }), 'Ausleihe gelöscht')
		);
	}
</script>

{#snippet dueOrReturned(loan: Loan)}
	{#if loan.returnedAt}
		<Badge variant="secondary" class="h-auto whitespace-normal"
			>zurückgegeben am {formatDate(loan.returnedAt)}</Badge
		>
	{:else if isOverdue(loan)}
		<Badge variant="destructive" class="h-auto whitespace-normal"
			>überfällig seit {formatDate(loan.dueAt)}</Badge
		>
	{:else if loan.dueAt}
		Rückgabe bis {formatDate(loan.dueAt)}
	{/if}
{/snippet}

<div class="space-y-4">
	<div class="flex items-center justify-between gap-4">
		<h1 class="text-2xl font-bold tracking-tight">Ausleihen</h1>
		<Button onclick={() => loanDialog.show()}><PlusIcon />Material ausleihen</Button>
	</div>

	<nav aria-label="Filter" class="flex gap-2">
		<Button
			size="sm"
			variant={data.showAll ? 'outline' : 'secondary'}
			href="/loans"
			aria-current={data.showAll ? undefined : 'page'}>Offen</Button
		>
		<Button
			size="sm"
			variant={data.showAll ? 'secondary' : 'outline'}
			href="/loans?all"
			aria-current={data.showAll ? 'page' : undefined}>Alle</Button
		>
	</nav>

	<div class="rounded-md border">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Ausgeliehen an</Table.Head>
					<Table.Head class="hidden md:table-cell">Material</Table.Head>
					<Table.Head class="hidden sm:table-cell">Ausgeliehen am</Table.Head>
					<Table.Head class="hidden sm:table-cell">Rückgabe</Table.Head>
					<Table.Head><span class="sr-only">Aktionen</span></Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#each data.loans as loan (loan.id)}
					{@const contents = loanContents(loan, materials, items)}
					<Table.Row>
						<Table.Cell class="whitespace-normal">
							<span class="font-medium">{loan.borrower}</span>
							{#if loan.note}<p class="text-sm text-muted-foreground">{loan.note}</p>{/if}
							<p class="text-sm md:hidden">{contents}</p>
							<p class="mt-1 text-sm text-muted-foreground sm:hidden">
								Ausgeliehen am {formatDate(loan.lentAt)}
							</p>
							<div class="text-sm text-muted-foreground sm:hidden">
								{@render dueOrReturned(loan)}
							</div>
						</Table.Cell>
						<Table.Cell class="hidden whitespace-normal md:table-cell">{contents}</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">{formatDate(loan.lentAt)}</Table.Cell>
						<Table.Cell class="hidden sm:table-cell">{@render dueOrReturned(loan)}</Table.Cell>
						<Table.Cell class="text-right">
							<div class="flex flex-wrap items-center justify-end gap-1">
								{#if !loan.returnedAt}
									<Button
										variant="outline"
										size="sm"
										class="pointer-coarse:h-11"
										aria-label="Rückgabe eintragen: Ausleihe an {loan.borrower}"
										title="Heute als zurückgegeben eintragen"
										onclick={() => markReturned(loan)}
									>
										Rückgabe eintragen
									</Button>
								{/if}
								<RowActions
									name="Ausleihe an {loan.borrower}"
									onedit={() => loanDialog.show(loan)}
									actions={[
										{
											label: 'Löschen',
											icon: Trash2Icon,
											destructive: true,
											onselect: () => remove(loan)
										}
									]}
								/>
							</div>
						</Table.Cell>
					</Table.Row>
				{:else}
					<Table.Row>
						<Table.Cell colspan={5} class="py-8 text-center text-muted-foreground">
							{data.showAll ? 'Noch keine Ausleihen.' : 'Nichts ist ausgeliehen.'}
						</Table.Cell>
					</Table.Row>
				{/each}
			</Table.Body>
		</Table.Root>
	</div>
</div>

<LoanDialog bind:this={loanDialog} materials={data.materials} items={data.items} />
<ConfirmDelete bind:this={confirmDelete} />
