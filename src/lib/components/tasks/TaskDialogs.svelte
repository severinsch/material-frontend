<!-- The dialogs around tasks, mounted once per page: a task opens read-only (tick boxes, read), "Bearbeiten" switches
     to the form; completing has its own, deliberately different dialog. -->
<script lang="ts">
	import { tick } from 'svelte';
	import { toast } from 'svelte-sonner';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import CheckIcon from '@lucide/svelte/icons/check';
	import CircleAlertIcon from '@lucide/svelte/icons/circle-alert';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import PackageIcon from '@lucide/svelte/icons/package';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import RepeatIcon from '@lucide/svelte/icons/repeat';
	import TagIcon from '@lucide/svelte/icons/tag';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import UserIcon from '@lucide/svelte/icons/user';
	import { isHttpError } from '@sveltejs/kit';
	import { refreshAll } from '$app/navigation';
	import { mutate, unwrap, type BulkMaterial, type Task } from '#lib/api/index.js';
	import { formatDate, today } from '#lib/format.js';
	import { itemUpdate } from '#lib/items.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import { Checkbox } from '#lib/components/ui/checkbox/index.js';
	import * as Dialog from '#lib/components/ui/dialog/index.js';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Textarea } from '#lib/components/ui/textarea/index.js';
	import { ChangeGuard } from '#lib/components/change-guard.svelte.js';
	import ConfirmDelete from '#lib/components/ConfirmDelete.svelte';
	import ConfirmDiscard from '#lib/components/ConfirmDiscard.svelte';
	import PurchaseDialog from '#lib/components/PurchaseDialog.svelte';
	import {
		addMonths,
		checklistProgress,
		draftOf,
		emptyDraft,
		getsNext,
		historyOf,
		isOverdue,
		linkNames,
		looseDue,
		mayComplete,
		mayEdit,
		repeatText,
		taskLabels,
		toggleLine,
		type TaskDraft
	} from '#lib/tasks.js';
	import { getTaskData } from './context.svelte.js';
	import NoteView from './NoteView.svelte';
	import TaskForm from './TaskForm.svelte';

	const tenant = getTenant();
	const api = $derived(tenant.api);
	const data = getTaskData();
	const canEdit = $derived(tenant.can('EDIT'));

	// ========= Viewing and editing =========

	let open = $state(false);
	let editing = $state(false);
	let taskId = $state<string | null>(null);
	let draft = $state<TaskDraft>(emptyDraft());
	let opened = $state(0);
	const guard = new ChangeGuard(() => draft);
	let confirmDelete: ConfirmDelete;

	/** The live task while viewing; it follows reloads of the page data. */
	const task = $derived(taskId ? data.byId.get(taskId) : undefined);
	const history = $derived(task ? historyOf(task, data.byId).slice(0, 3) : []);

	/** Opens [task] read-only. */
	export function show(existing: Task) {
		taskId = existing.id;
		editing = false;
		open = true;
	}

	/** Opens the form for a new task, e.g. with a material linked. */
	export function create(preset: Partial<TaskDraft> = {}) {
		taskId = null;
		startEditing(emptyDraft(preset));
		open = true;
	}

	function edit() {
		if (task) startEditing({ ...draftOf(task), note: noteOf(task) ?? '' });
	}

	function startEditing(values: TaskDraft) {
		draft = values;
		opened++;
		editing = true;
		guard.start();
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		const id = taskId;
		const body = { ...draft, note: draft.note?.trim() ? draft.note : null };
		void guard
			.save(async () => {
				if (!body.title.trim()) {
					toast.error('Die Aufgabe braucht einen Titel.');
					return false;
				}
				if (!id) {
					return mutate(api.POST('/tasks', { body }), (t) => `Aufgabe „${t.title}“ angelegt`);
				}
				// Ticks still being saved would overwrite the note otherwise.
				await noteSaves;
				return mutate(
					api.PUT('/tasks/{id}', { params: { path: { id } }, body }),
					'Aufgabe gespeichert'
				);
			})
			.then((saved) => {
				if (!saved) return;
				// Back to the task, unless it is new or no longer on the page (e.g. no longer about the material shown).
				if (task) editing = false;
				else open = false;
			});
	}

	function cancel() {
		if (task) editing = false;
		else open = false;
	}

	function remove() {
		if (!task) return;
		const id = task.id;
		confirmDelete.show(`Aufgabe „${task.title}“`, async () => {
			const ok = await mutate(
				api.DELETE('/tasks/{id}', { params: { path: { id } } }),
				'Aufgabe gelöscht'
			);
			if (ok) open = false;
			return ok;
		});
	}

	// ========= Ticking checklist boxes =========

	/** The notes with the user's ticks by task id, ahead of the loaded tasks until all ticks are saved and reloaded. */
	let ticked = $state<Record<string, string>>({});
	/** Saves of ticks, sent one after another so that none overwrites a later tick. */
	let noteSaves = Promise.resolve();
	let pendingNoteSaves = 0;

	/** [t]'s note as shown: with the user's ticks while they are being saved. */
	const noteOf = (t: Task) => ticked[t.id] ?? t.note;
	const shownNote = $derived(task && noteOf(task));

	/** Ticks a checklist box of the task at once, and saves its note (without a toast). */
	function toggle(index: number) {
		if (!task) return;
		const id = task.id;
		const note = toggleLine(noteOf(task) ?? '', index);
		ticked[id] = note;
		pendingNoteSaves++;
		noteSaves = noteSaves.then(() => saveNote(id, note));
	}

	/** Saves [note] with the task's other values as loaded; reloads the page data after the last pending save. */
	async function saveNote(id: string, note: string) {
		const current = data.byId.get(id);
		try {
			if (current) {
				await unwrap(
					api.PUT('/tasks/{id}', {
						params: { path: { id } },
						body: { ...draftOf(current), note }
					})
				);
			}
		} catch {
			toast.error('Das Kästchen konnte nicht gespeichert werden.');
		}
		if (--pendingNoteSaves > 0) return;
		await refreshAll();
		// Unless ticked again meanwhile, the loaded tasks now have all ticks that were saved.
		if (pendingNoteSaves === 0) ticked = {};
	}

	// ========= Completing =========

	let completing = $state<Task | null>(null);
	let completeOpen = $state(false);
	let completionNote = $state('');
	/** The interval of the task being completed; a rule's task recurs by the rule's current one. */
	let repeatMonths = $state<number | null>(null);
	let nextDue = $state('');
	/** The next due date the server picks by itself; [nextDue] is only sent if the user picked another one. */
	let defaultNextDue = '';
	let chosen = $state<string[]>([]);
	let purchaseMaterial = $state<BulkMaterial | null>(null);
	let purchaseDialog = $state<PurchaseDialog>();

	interface FollowUp {
		id: string;
		label: string;
		/** Runs with the completion's note. */
		run: (note: string | null) => Promise<unknown>;
	}

	/** What could sensibly follow completing [t]; offered unticked. */
	function followUps(t: Task): FollowUp[] {
		const result: FollowUp[] = [];
		for (const id of t.itemIds) {
			const item = data.targets.items.get(id);
			if (item?.status !== 'IN_REPAIR') continue;
			result.push({
				id: `active:${id}`,
				label: `${linkNames({ materialIds: [], itemIds: [id] }, data.targets)[0]} wieder auf „Aktiv“ setzen`,
				run: () =>
					unwrap(
						api.PUT('/items/{id}', {
							params: { path: { id } },
							body: itemUpdate(item, { status: 'ACTIVE' })
						})
					)
			});
		}
		const reportId = t.damageReportId;
		if (reportId) {
			result.push({
				id: 'damage',
				label: 'Schadensmeldung als behoben markieren',
				run: async (note) => {
					const report = await unwrap(
						api.GET('/damages/{id}', { params: { path: { id: reportId } } })
					);
					if (report.resolvedAt) return;
					await unwrap(
						api.PUT('/damages/{id}', {
							params: { path: { id: reportId } },
							body: {
								itemId: report.itemId,
								description: report.description,
								reportedBy: report.reportedBy ?? null,
								isResolved: true,
								resolutionNotes: report.resolutionNotes ?? note
							}
						})
					);
				}
			});
		}
		// Last, since it opens a dialog.
		const bulk = t.materialIds
			.map((id) => data.targets.materials.get(id))
			.find((m): m is BulkMaterial => m?.trackingType === 'BULK' && !m.archivedAt);
		if (t.label === 'PURCHASE' && bulk) {
			result.push({
				id: 'purchase',
				label: `Kauf von ${bulk.name} erfassen`,
				run: () => recordPurchase(bulk)
			});
		}
		return result;
	}

	async function recordPurchase(material: BulkMaterial) {
		purchaseMaterial = material;
		// Renders the dialog for this material.
		await tick();
		purchaseDialog?.show();
	}

	// The follow-ups change material, items and damage reports, which needs EDIT.
	const actions = $derived(completing && canEdit ? followUps(completing) : []);
	// From the live task and the user's ticks: [completing] is the task as it was when the dialog opened.
	const progress = $derived(
		completing ? checklistProgress(noteOf(data.byId.get(completing.id) ?? completing)) : undefined
	);

	/**
	 * Completes an open task, asking for a note, the next due date and follow-ups. A completed task is reopened only
	 * from its dialog ("Wieder öffnen"), so a stray tap can't undo a completion.
	 */
	export function check(t: Task) {
		if (t.completedAt) return;
		completing = t;
		completionNote = '';
		chosen = [];
		const next = getsNext(t, data.targets.items);
		proposeNext(next ? t.repeatMonths! : null);
		completeOpen = true;
		if (next && t.ruleId) void proposeRuleInterval(t.id, t.ruleId);
	}

	/** Shows [months] as the interval and today + [months] as the next due date, as the server would pick it. */
	function proposeNext(months: number | null) {
		repeatMonths = months;
		nextDue = defaultNextDue = months ? addMonths(today(), months) : '';
	}

	/** A rule's task recurs by the rule's current interval, which differs from the task's if the rule was changed. */
	async function proposeRuleInterval(id: string, ruleId: string) {
		const { data: rule } = await api.GET('/task-rules/{id}', {
			params: { path: { id: ruleId } }
		});
		// Unless the user picked a date meanwhile.
		if (rule && completing?.id === id && nextDue === defaultNextDue) proposeNext(rule.repeatMonths);
	}

	async function complete(event: SubmitEvent) {
		event.preventDefault();
		const t = completing;
		// Closed already: a second tap while the dialog fades out.
		if (!t || !completeOpen) return;
		completeOpen = false;
		const selected = actions.filter((a) => chosen.includes(a.id));
		const note = completionNote.trim() || null;
		const path = { params: { path: { id: t.id } } };
		const ok = await mutate(
			api.POST('/tasks/{id}/complete', {
				...path,
				body: { note, nextDueDate: nextDue && nextDue !== defaultNextDue ? nextDue : null }
			}),
			`Erledigt: ${t.title}`,
			// Reopening wouldn't undo the follow-ups.
			{ undo: selected.length === 0 ? () => api.POST('/tasks/{id}/reopen', path) : undefined }
		);
		if (!ok || selected.length === 0) return;
		for (const action of selected) {
			try {
				await action.run(note);
			} catch (e) {
				toast.error(`Nicht geklappt: ${action.label}`, {
					description: isHttpError(e) ? e.body.message : undefined
				});
			}
		}
		await refreshAll();
	}

	let reopening = $state(false);

	async function reopen(t: Task) {
		const next = data.tasks.find((other) => other.previousId === t.id && !other.completedAt);
		reopening = true;
		try {
			await mutate(
				api.POST('/tasks/{id}/reopen', { params: { path: { id: t.id } } }),
				next ? 'Wieder geöffnet; die nächste Aufgabe wurde entfernt' : 'Wieder geöffnet'
			);
		} finally {
			reopening = false;
		}
	}
</script>

{#snippet fact(icon: typeof CalendarIcon, text: string, danger = false)}
	{@const Icon = icon}
	<div class={['flex items-center gap-2', danger && 'text-destructive']}>
		<Icon class="size-4 shrink-0 text-muted-foreground" />
		<span class="min-w-0">{text}</span>
	</div>
{/snippet}

<Dialog.Root bind:open>
	<Dialog.Content
		class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg"
		showCloseButton={!guard.saving}
		onEscapeKeydown={editing ? guard.intercept : undefined}
		onInteractOutside={editing ? guard.intercept : undefined}
	>
		{#if editing}
			<form onsubmit={save} class="grid gap-4">
				<Dialog.Title class="sr-only">{taskId ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</Dialog.Title
				>
				{#key opened}
					<TaskForm bind:task={draft} autofocus={!taskId} assigneeName={task?.assigneeName} />
				{/key}
				<Dialog.Footer
					class="sticky -bottom-4 z-10 bg-popover bg-linear-to-r from-muted/50 to-muted/50"
				>
					{#if task && canEdit}
						<Button
							type="button"
							variant="ghost"
							class="mr-auto text-destructive"
							onclick={remove}
							disabled={guard.saving}
						>
							<Trash2Icon />Löschen
						</Button>
					{/if}
					<Button type="button" variant="outline" onclick={cancel} disabled={guard.saving}>
						Abbrechen
					</Button>
					<Button type="submit" disabled={guard.saving}>
						{#if guard.saving}<LoaderIcon class="animate-spin" />{/if}
						{taskId ? 'Speichern' : 'Anlegen'}
					</Button>
				</Dialog.Footer>
			</form>
		{:else if task}
			<div class="grid gap-4">
				<Dialog.Header>
					<Dialog.Title
						class={['pr-6 text-lg', task.completedAt && 'text-muted-foreground line-through']}
						>{task.title}</Dialog.Title
					>
				</Dialog.Header>

				<div class="grid gap-1.5 text-sm">
					{#if task.urgent && !task.completedAt}{@render fact(
							CircleAlertIcon,
							'Dringend',
							true
						)}{/if}
					{#if task.dueDate && !task.completedAt}
						{@render fact(
							CalendarIcon,
							`${looseDue(task.dueDate)} (${formatDate(task.dueDate)})`,
							isOverdue(task)
						)}
					{/if}
					{#if task.materialIds.length + task.itemIds.length}
						{@render fact(PackageIcon, linkNames(task, data.targets).join(', '))}
					{/if}
					{#if task.assigneeName}{@render fact(UserIcon, task.assigneeName)}{/if}
					{#if task.repeatMonths}
						{@render fact(RepeatIcon, `${repeatText(task.repeatMonths)}, ab Erledigung`)}
					{/if}
					{#if task.label !== 'OTHER'}{@render fact(TagIcon, taskLabels[task.label])}{/if}
				</div>

				{#if shownNote}
					<div class="rounded-md bg-muted/40 p-3">
						<NoteView
							note={shownNote}
							ontoggle={mayEdit(task, tenant) && !task.completedAt ? toggle : undefined}
						/>
					</div>
				{/if}

				{#if task.completedAt}
					<p class="text-sm text-muted-foreground">
						Erledigt am {formatDate(task.completedAt)} von {task.completedBy}{task.completionNote
							? `: ${task.completionNote}`
							: ''}
					</p>
				{/if}

				{#if task.occasion || task.damageReportId || task.ruleId || history.length > 0}
					<div class="grid gap-1 border-t pt-3 text-xs text-muted-foreground">
						{#if task.occasion}<p>Aus der Routine für „{task.occasion}“</p>{/if}
						{#if task.ruleId}
							<p>
								Aus einer Regel{#if canEdit}
									(<a class="underline" href={tenant.href('/tasks/manage')}>Aufgaben verwalten</a
									>){/if}
							</p>
						{/if}
						{#if task.damageReportId}<p>Aus einer Schadensmeldung</p>{/if}
						{#each history as done (done.id)}
							<p>
								Erledigt am {formatDate(done.completedAt)} von {done.completedBy}{done.completionNote
									? `: ${done.completionNote}`
									: ''}
							</p>
						{/each}
					</div>
				{/if}

				{#if mayEdit(task, tenant) || mayComplete(task, tenant)}<Dialog.Footer>
						{#if mayEdit(task, tenant)}
							<Button variant="outline" onclick={edit}><PencilIcon />Bearbeiten</Button>
						{/if}
						{#if mayComplete(task, tenant)}
							{#if task.completedAt}
								<Button variant="outline" disabled={reopening} onclick={() => void reopen(task)}>
									Wieder öffnen
								</Button>
							{:else}
								<Button
									onclick={() => {
										open = false;
										check(task);
									}}><CheckIcon />Erledigt…</Button
								>
							{/if}
						{/if}
					</Dialog.Footer>{/if}
			</div>
		{/if}
		<ConfirmDiscard {guard} ondiscard={() => (open = false)} />
	</Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={completeOpen}>
	<Dialog.Content
		class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-sm"
		showCloseButton={false}
	>
		{#if completing}
			<form onsubmit={complete} class="grid gap-4">
				<div class="grid justify-items-center gap-2 text-center">
					<span
						class="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
					>
						<CheckIcon class="size-6" />
					</span>
					<Dialog.Title class="text-base">{completing.title}</Dialog.Title>
					<Dialog.Description>Als erledigt markieren</Dialog.Description>
				</div>

				{#if progress && progress.done < progress.total}
					{@const unticked = progress.total - progress.done}
					<p class="rounded-md bg-muted/50 px-3 py-2 text-center text-sm text-muted-foreground">
						{unticked} von {progress.total} Punkten {unticked === 1 ? 'ist' : 'sind'} nicht abgehakt.
					</p>
				{/if}

				<Textarea
					bind:value={completionNote}
					aria-label="Notiz"
					placeholder="Notiz, z. B. „2 Pflaster nachgekauft“ (optional)"
					class="min-h-12"
				/>

				{#if repeatMonths}
					<div class="flex flex-wrap items-center justify-between gap-2 text-sm">
						<label for="done-next" class="text-muted-foreground">
							Nächstes Mal <span class="text-xs">({repeatText(repeatMonths)})</span>
						</label>
						<Input id="done-next" type="date" class="w-auto" bind:value={nextDue} />
					</div>
				{/if}

				{#if actions.length > 0}
					<div class="grid gap-2">
						{#each actions as action (action.id)}
							<label class="flex items-center gap-2 text-sm">
								<Checkbox
									checked={chosen.includes(action.id)}
									onCheckedChange={(on) =>
										(chosen = on
											? [...chosen, action.id]
											: chosen.filter((id) => id !== action.id))}
								/>
								{action.label}
							</label>
						{/each}
					</div>
				{/if}

				<div class="grid gap-2">
					<Button type="submit" class="w-full bg-emerald-600 text-white hover:bg-emerald-700">
						<CheckIcon />Erledigt
					</Button>
					<Button
						type="button"
						variant="ghost"
						class="w-full"
						onclick={() => (completeOpen = false)}
					>
						Abbrechen
					</Button>
				</div>
			</form>
		{/if}
	</Dialog.Content>
</Dialog.Root>

{#if purchaseMaterial}
	<PurchaseDialog bind:this={purchaseDialog} material={purchaseMaterial} />
{/if}
<ConfirmDelete bind:this={confirmDelete} />
