<script lang="ts">
	import CheckIcon from '@lucide/svelte/icons/check';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import CopyPlusIcon from '@lucide/svelte/icons/copy-plus';
	import ListChecksIcon from '@lucide/svelte/icons/list-checks';
	import MinusIcon from '@lucide/svelte/icons/minus';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import { toast } from 'svelte-sonner';
	import { SvelteSet } from 'svelte/reactivity';
	import { afterNavigate, replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import type { Kit, KitGroup, KitGroupAmount, KitGroupOption } from '#lib/api/index.js';
	import { formatDate, today, variantName, variantsById } from '#lib/format.js';
	import {
		activePins,
		allocate,
		needsOf,
		optionId,
		isPinnable,
		sortedOptions,
		type MaterialNeed
	} from '#lib/kits/allocate.js';
	import {
		byPlace,
		combineLines,
		describeShortage,
		groupLabel,
		hasAlternatives,
		hasChoices,
		lineLabel,
		NO_LOCATION,
		newLine,
		parseSelection,
		placeOf,
		serializeSelection,
		variantsToFind,
		type PackingLine
	} from '#lib/kits/packing.js';
	import { availableNow, settings } from '#lib/settings.svelte.js';
	import { getTenant } from '#lib/tenant.js';
	import { Badge } from '#lib/components/ui/badge/index.js';
	import { Button } from '#lib/components/ui/button/index.js';
	import * as Card from '#lib/components/ui/card/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import * as Select from '#lib/components/ui/select/index.js';
	import { Switch } from '#lib/components/ui/switch/index.js';
	import LoanedToggle from '#lib/components/LoanedToggle.svelte';

	let { data } = $props();

	const tenant = getTenant();
	const canEdit = $derived(tenant.can('EDIT'));

	/** The lines of the packing list in their order; the same kit can be on several lines with other choices. */
	// svelte-ignore state_referenced_locally
	let lines: PackingLine[] = $state(parseSelection(page.url.searchParams, data.kits));
	let copied = $state(false);
	/** Whether the needed materials list the pieces per line of the packing list. */
	let showBreakdown = $state(false);
	/** Groups of the kit cards (`<kit id>/<group index>`) whose less preferred options are shown. */
	const openGroups = new SvelteSet<string>();

	function toggleGroup(key: string) {
		if (!openGroups.delete(key)) openGroups.add(key);
	}

	/** Lines whose alternatives were opened ("Alternativen festlegen"); lines with pins show them anyway. */
	const revealed = new SvelteSet<PackingLine>();

	// The packing list lives in the URL (see parseSelection), so it survives reloads and can be shared as a link.
	/** replaceState only works once the router has started. */
	let routerReady = $state(false);
	afterNavigate(({ type }) => {
		if (type !== 'enter') {
			lines = parseSelection(page.url.searchParams, data.kits);
			revealed.clear();
		}
		routerReady = true;
	});

	$effect(() => {
		if (!routerReady) return;
		// Based on `location`, not `page`: this effect must only depend on the lines, since replaceState changes
		// `page.state`.
		const url = new URL(location.href);
		url.searchParams.delete('kit');
		for (const value of serializeSelection(lines)) url.searchParams.append('kit', value);
		if (url.search !== location.search) replaceState(url, {});
	});

	const materials = $derived(new Map(data.materials.map((material) => [material.id, material])));
	const variants = $derived(variantsById(data.materials));
	/** The variant ids of each material, by material id. */
	const variantIds = $derived(
		new Map(data.materials.map((material) => [material.id, material.variants.map((v) => v.id)]))
	);
	const kits = $derived(new Map(data.kits.map((kit) => [kit.id, kit])));
	const kitCount = $derived(lines.reduce((sum, line) => sum + line.quantity, 0));

	/** Identical lines combined, for the allocation, the summary and the printed list. */
	const combined = $derived(combineLines(lines, kits));
	const labels = $derived(combined.map((line) => lineLabel(line, plainName)));

	/** Usable pieces per variant id. */
	const stock = $derived(
		new Map([...variants].map(([id, { variant }]) => [id, availableNow(variant)]))
	);
	const allocation = $derived(allocate(combined, stock, variantIds));
	/**
	 * Sorted by material; the needs of a material's specific variants come in the order of its variants, directly
	 * before the need for any of its variants, which names them as exceptions.
	 */
	const needs = $derived.by(() => {
		const all = needsOf(allocation.assignments, stock, variantIds);
		return all
			.map((need) => {
				const material = materials.get(need.materialId);
				const variantRank = material?.variants.findIndex((v) => v.id === need.variantId) ?? -1;
				return {
					...need,
					key: `${need.materialId}/${need.variantId ?? '*'}`,
					name: needName(need, all),
					materialName: material?.name ?? '',
					rank: need.variantId ? variantRank : Infinity,
					place: material
						? placeOf(
								material,
								variantsToFind(need, variantIds),
								data.items,
								settings.subtractLoaned
							)
						: { location: NO_LOCATION, detail: '' }
				};
			})
			.sort((a, b) => a.materialName.localeCompare(b.materialName) || a.rank - b.rank);
	});
	const shortages = $derived(
		allocation.shortages.map((shortage) =>
			describeShortage(shortage, combined[shortage.line], labels[shortage.line], optionName)
		)
	);
	/** Needs grouped by storage location for the printed list. */
	const needsByLocation = $derived([
		...Map.groupBy(
			needs.toSorted((a, b) => byPlace(a.place, b.place)),
			(need) => need.place.location
		)
	]);
	const selectedSummary = $derived(
		combined.map((line, index) => `${line.quantity}× ${labels[index]}`).join(', ')
	);

	type OptionRef = Pick<KitGroupOption, 'materialId' | 'variantId'>;

	/** Usable pieces for [option]: of its variant, or of all variants of its material. */
	function availableOf(option: OptionRef) {
		const ids = option.variantId ? [option.variantId] : (variantIds.get(option.materialId) ?? []);
		return ids.reduce((sum, id) => sum + (stock.get(id) ?? 0), 0);
	}

	/** The name of [option] for labels: "Seil 15 m" for a variant, otherwise the material's name. */
	function plainName(option: OptionRef) {
		const found = option.variantId ? variants.get(option.variantId) : undefined;
		if (found) return variantName(found.material, found.variant);
		return materials.get(option.materialId)?.name ?? 'Unbekanntes Material';
	}

	/** The name of [option], e.g. "Seil 15 m", or "Seil (beliebig)" for any of several variants. */
	function optionName(option: OptionRef) {
		const material = materials.get(option.materialId);
		return !option.variantId && material && material.variants.length > 1
			? `${material.name} (beliebig)`
			: plainName(option);
	}

	/**
	 * The name of a need: its variant, or for any variant e.g. "Seil (beliebig, außer den 2× 20 m)", naming the
	 * pieces of specific variants in [all] needs that are packed separately.
	 */
	function needName(need: MaterialNeed, all: MaterialNeed[]) {
		if (need.variantId) return plainName(need);
		const material = materials.get(need.materialId);
		const specific = all.flatMap((other) =>
			other.materialId === need.materialId && other.variantId
				? [`${other.required}× ${variants.get(other.variantId)?.variant.name ?? '?'}`]
				: []
		);
		const except = specific.length > 0 ? `, außer den ${specific.join(', ')}` : '';
		return `${material?.name ?? 'Unbekanntes Material'} (beliebig${except})`;
	}

	function missingText(count: number) {
		return `${count} ${count === 1 ? 'fehlt' : 'fehlen'}`;
	}

	/** Pieces of a material with [unitValue] needed to fill [units] in one kit. */
	function piecesFor(units: number, unitValue: number) {
		return Math.ceil(units / unitValue);
	}

	/**
	 * The units of a group shown like a group with a single amount: its amount, or for an optional group ("ohne" = 0,
	 * "mit" = 12) the amount it is packed with.
	 */
	function singleUnits(group: KitGroup): number | undefined {
		const [first, second, ...rest] = group.amounts;
		if (!second) return first?.requiredUnits;
		if (rest.length === 0 && (first.requiredUnits === 0 || second.requiredUnits === 0)) {
			return first.requiredUnits + second.requiredUnits;
		}
	}

	/** The amounts of a group, e.g. "Einbein 1× (Standard) · Dreibein 3×", in pieces of [unitValue] or in units. */
	function amountsText(group: KitGroup, unitValue?: number) {
		return group.amounts
			.map((amount, index) => {
				const units = amount.requiredUnits;
				const count =
					units === 0 ? '' : unitValue ? ` ${piecesFor(units, unitValue)}×` : ` ${units}`;
				return `${amount.label}${count}${index === 0 ? ' (Standard)' : ''}`;
			})
			.join(' · ');
	}

	/** An amount in the line's select, e.g. "Dreibein · 3× Jurtenstange", "Groß · 9 Einheiten" or "ohne". */
	function amountOption(group: KitGroup, { label, requiredUnits }: KitGroupAmount) {
		if (requiredUnits === 0) return label ?? '';
		const [single] = group.options.length === 1 ? group.options : [];
		const count = single
			? `${piecesFor(requiredUnits, single.unitValue)}× ${optionName(single)}`
			: `${requiredUnits} Einheiten`;
		return `${label} · ${count}`;
	}

	function linesOf(kit: Kit) {
		return lines.filter((line) => line.kitId === kit.id);
	}

	/** Whether [line] has the default choices and no pins that count. */
	/**
	 * Whether [line] has the default choices and no pins, not even inactive ones: adding to a line whose windows are
	 * pinned while packed without would pin the added kits too once "mit" is chosen.
	 */
	function isPlain(line: PackingLine) {
		return line.choices.every((choice) => choice === 0) && line.pins.every((pin) => !pin);
	}

	/** Adds [kit] with the default choices and no pins, to the line that already has them if there is one. */
	function addKit(kit: Kit) {
		const existing = linesOf(kit).find((line) => isPlain(line));
		if (existing) existing.quantity++;
		else lines.push(newLine(kit));
	}

	/**
	 * Adds a copy of [line] with quantity 1 below it, to choose other amounts or alternatives for it. It keeps the
	 * amounts but starts with automatic alternatives, like a new line.
	 */
	function addCopy(line: PackingLine) {
		const copy = {
			...line,
			quantity: 1,
			choices: [...line.choices],
			pins: line.pins.map(() => null)
		};
		lines.splice(lines.indexOf(line) + 1, 0, copy);
	}

	/** The groups of [line] whose option can be pinned: several options, and packed (not "ohne"). */
	function pinnableGroups(kit: Kit, line: PackingLine) {
		return kit.groups.flatMap((group, index) =>
			isPinnable({ kit, choices: line.choices }, index) ? [{ group, index }] : []
		);
	}

	/** The select value of a group without a pin. */
	const AUTOMATIC = 'automatisch';

	function setPin(line: PackingLine, groupIndex: number, value: string) {
		// Keeps the selects open when the last pin goes back to automatic.
		revealed.add(line);
		line.pins[groupIndex] = value === AUTOMATIC ? null : value;
	}

	function setQuantity(line: PackingLine, quantity: number) {
		if (quantity > 0) line.quantity = quantity;
		else {
			lines.splice(lines.indexOf(line), 1);
			revealed.delete(line);
		}
	}

	function clearLines() {
		lines = [];
		revealed.clear();
	}

	function listText() {
		const text = [`Packliste: ${selectedSummary}`];
		for (const [location, located] of needsByLocation) {
			text.push('', location);
			for (const need of located) {
				const detail = need.place.detail ? ` (${need.place.detail})` : '';
				const missing = need.missing > 0 ? ` – ${missingText(need.missing)}` : '';
				text.push(`- ${need.required}× ${need.name}${detail}${missing}`);
			}
		}
		if (shortages.length > 0)
			text.push('', 'Fehlt:', ...shortages.map((shortage) => `- ${shortage}`));
		return text.join('\n');
	}

	async function copyList() {
		// The clipboard API only exists on HTTPS (and localhost).
		const success = await navigator.clipboard?.writeText(listText()).then(
			() => true,
			() => false
		);
		if (!success) {
			toast.error('Die Liste konnte nicht kopiert werden. Kopieren geht nur über HTTPS.');
			return;
		}
		copied = true;
		setTimeout(() => (copied = false), 2000);
	}
</script>

{#snippet availability(option: OptionRef, needed = 0)}
	{@const available = availableOf(option)}
	<span
		class="shrink-0 text-xs tabular-nums {needed > available
			? 'text-destructive'
			: 'text-muted-foreground'}"
	>
		{available} verfügbar
	</span>
{/snippet}

{#snippet quantityButtons(line: PackingLine, name: string)}
	<Button
		variant="outline"
		size="icon-sm"
		aria-label="Weniger {name}"
		onclick={() => setQuantity(line, line.quantity - 1)}
	>
		<MinusIcon />
	</Button>
	<span class="w-6 text-center font-medium tabular-nums"
		>{line.quantity}<span class="sr-only">× {name}</span></span
	>
	<Button
		variant="outline"
		size="icon-sm"
		aria-label="Mehr {name}"
		onclick={() => setQuantity(line, line.quantity + 1)}
	>
		<PlusIcon />
	</Button>
{/snippet}

<div class={['space-y-4 print:hidden', lines.length > 0 && 'pb-14 lg:pb-0']}>
	<div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight">Sets</h1>
			<p class="text-muted-foreground">Wähle Sets aus, um zu sehen, was eingepackt werden muss.</p>
		</div>
		{#if canEdit}
			<Button href={tenant.href('/kits/new')}><PlusIcon />Set anlegen</Button>
		{/if}
	</div>

	<div class="grid gap-6 lg:grid-cols-3">
		<div class="grid content-start gap-4 sm:grid-cols-2 lg:col-span-2">
			{#each data.kits as kit (kit.id)}
				{@const choices = hasChoices(kit)}
				{@const kitLines = linesOf(kit)}
				{@const quantity = kitLines.reduce((sum, line) => sum + line.quantity, 0)}
				<Card.Root>
					<Card.Header>
						<Card.Title>{kit.name}</Card.Title>
						{#if kit.description}<Card.Description>{kit.description}</Card.Description>{/if}
						{#if canEdit}
							<Card.Action>
								<Button
									variant="ghost"
									size="icon-sm"
									href={tenant.href(`/kits/${kit.id}`)}
									aria-label="{kit.name} bearbeiten"
									title="Bearbeiten"
								>
									<PencilIcon />
								</Button>
							</Card.Action>
						{/if}
					</Card.Header>
					<Card.Content>
						<ul class="space-y-2 text-sm">
							{#each kit.groups as group, index (index)}
								{@const units = singleUnits(group)}
								{@const [single] = group.options.length === 1 ? group.options : []}
								<li>
									<div class="flex items-center gap-2">
										<span class="flex-1">
											{#if single && units !== undefined}
												{piecesFor(units, single.unitValue)}× {optionName(single)}
												{#if group.name}<span class="text-muted-foreground">({group.name})</span
													>{/if}
											{:else if single}
												{#if group.name}{group.name}:{/if}
												{amountsText(group, single.unitValue)}
												{optionName(single)}
											{:else}
												{group.name ?? 'Alternativen'}
												<span class="text-muted-foreground"
													>· {units ?? amountsText(group)} Einheiten</span
												>
											{/if}
										</span>
										{#if units !== undefined && group.amounts.length > 1}
											<Badge variant="outline">optional</Badge>
										{/if}
										{#if single}
											{@render availability(
												single,
												piecesFor(units ?? group.amounts[0].requiredUnits, single.unitValue)
											)}
										{/if}
									</div>
									{#if !single}
										{@const key = `${kit.id}/${index}`}
										{@const sorted = sortedOptions(group)}
										<!-- Many alternatives in every card would clutter them, so only the most preferred ones show. -->
										{@const preferred = sorted.filter(
											(option) => option.priority === sorted[0].priority
										)}
										{@const hidden = sorted.length - preferred.length}
										<ul class="mt-1 ml-1 space-y-0.5 border-l pl-2 text-xs">
											{#each openGroups.has(key) ? sorted : preferred as option, rank (optionId(option))}
												<li class="flex items-center gap-1.5">
													<span class="flex-1">
														{#if rank > 0}<span class="text-muted-foreground">oder</span>{/if}
														{#if units !== undefined}
															{piecesFor(units, option.unitValue)}× {optionName(option)}
														{:else}
															{optionName(option)}
															<span class="text-muted-foreground"
																>({option.unitValue}
																{option.unitValue === 1 ? 'Einheit' : 'Einheiten'})</span
															>
														{/if}
														{#if rank === 0}
															<Badge variant="secondary" class="ml-1 px-1.5 py-0 text-[0.7rem]"
																>bevorzugt</Badge
															>
														{/if}
													</span>
													{@render availability(option)}
												</li>
											{/each}
										</ul>
										{#if hidden > 0}
											<button
												class="mt-0.5 ml-3.5 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
												aria-expanded={openGroups.has(key)}
												onclick={() => toggleGroup(key)}
											>
												{openGroups.has(key)
													? 'Weniger anzeigen'
													: `+${hidden} ${hidden === 1 ? 'Alternative' : 'Alternativen'}`}
											</button>
										{/if}
									{/if}
								</li>
							{/each}
						</ul>
					</Card.Content>
					<Card.Footer class="flex-wrap gap-2">
						{#if quantity === 0}
							<Button
								size="sm"
								class="flex-1"
								aria-label="{kit.name} zur Packliste hinzufügen"
								onclick={() => addKit(kit)}><PlusIcon />Zur Packliste</Button
							>
						{:else if !choices && kitLines.length === 1 && isPlain(kitLines[0])}
							{@render quantityButtons(kitLines[0], kit.name)}
							<span class="text-sm text-muted-foreground">auf der Packliste</span>
						{:else}
							<Button
								variant="outline"
								size="icon-sm"
								aria-label="Noch ein {kit.name} zur Packliste hinzufügen"
								title="Zur Packliste"
								onclick={() => addKit(kit)}
							>
								<PlusIcon />
							</Button>
							<span class="text-sm text-muted-foreground">
								<span class="font-medium text-foreground tabular-nums">{quantity}</span> auf der Packliste
							</span>
						{/if}
					</Card.Footer>
				</Card.Root>
			{:else}
				<p class="text-muted-foreground">Noch keine Sets.</p>
			{/each}
		</div>

		<aside
			id="packliste"
			aria-labelledby="packliste-heading"
			class="scroll-mt-20 space-y-4 lg:sticky lg:top-20 lg:self-start"
		>
			<div class="flex items-center justify-between gap-2">
				<h2 id="packliste-heading" class="text-lg font-semibold">Packliste</h2>
				{#if lines.length > 0}
					<div class="flex">
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Liste kopieren"
							title="Liste kopieren"
							onclick={copyList}
						>
							{#if copied}<CheckIcon />{:else}<CopyIcon />{/if}
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Drucken"
							title="Drucken"
							onclick={() => window.print()}
						>
							<PrinterIcon />
						</Button>
						<Button variant="ghost" size="sm" onclick={clearLines}>Leeren</Button>
					</div>
				{/if}
			</div>
			<LoanedToggle />

			{#if lines.length === 0}
				<p class="text-sm text-muted-foreground">
					Füge Sets hinzu, um zu sehen, welche Materialien sie brauchen.
				</p>
			{:else}
				<Card.Root>
					<Card.Header>
						<Card.Title>Ausgewählte Sets</Card.Title>
					</Card.Header>
					<Card.Content>
						<ul class="space-y-3 text-sm">
							{#each lines as line (line)}
								{@const kit = kits.get(line.kitId)}
								{#if kit}
									{@const label = lineLabel({ kit, ...line }, plainName)}
									<li class="space-y-1.5">
										<div class="flex items-center gap-1">
											<span class="flex-1">{kit.name}</span>
											{@render quantityButtons(line, label)}
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label="{label} von der Packliste entfernen"
												title="Entfernen"
												onclick={() => setQuantity(line, 0)}
											>
												<Trash2Icon />
											</Button>
										</div>
										{#if hasChoices(kit) || hasAlternatives(kit)}
											{@const pinnable = pinnableGroups(kit, line)}
											{@const showPins =
												revealed.has(line) || activePins({ kit, ...line }).some(Boolean)}
											<div class="flex flex-wrap items-center gap-1.5">
												{#each kit.groups as group, g (g)}
													{#if group.amounts.length > 1}
														{@const name = groupLabel(group, plainName)}
														<Select.Root
															type="single"
															value={String(line.choices[g])}
															onValueChange={(value) => (line.choices[g] = Number(value))}
														>
															<Select.Trigger size="sm" aria-label="{name} für {kit.name}">
																{name}: {group.amounts[line.choices[g]]?.label}
															</Select.Trigger>
															<Select.Content>
																{#each group.amounts as amount, a (a)}
																	<Select.Item
																		value={String(a)}
																		label={amountOption(group, amount)}
																	/>
																{/each}
															</Select.Content>
														</Select.Root>
													{/if}
												{/each}
												{#if showPins}
													{#each pinnable as { group, index } (index)}
														{@const name = groupLabel(group, plainName)}
														{@const pinned = group.options.find(
															(option) => optionId(option) === line.pins[index]
														)}
														<Select.Root
															type="single"
															value={line.pins[index] ?? AUTOMATIC}
															onValueChange={(value) => setPin(line, index, value)}
														>
															<Select.Trigger
																size="sm"
																aria-label="Alternative für {name} bei {kit.name}"
															>
																{name}: {pinned ? optionName(pinned) : 'automatisch'}
															</Select.Trigger>
															<Select.Content>
																<Select.Item value={AUTOMATIC} label="Automatisch" />
																{#each sortedOptions(group) as option (optionId(option))}
																	<Select.Item
																		value={optionId(option)}
																		label="{optionName(option)} · {availableOf(option)} verfügbar"
																	/>
																{/each}
															</Select.Content>
														</Select.Root>
													{/each}
												{:else if pinnable.length > 0}
													<Button
														variant="ghost"
														size="sm"
														class="h-7 text-muted-foreground"
														aria-label="Alternativen für {label} festlegen"
														onclick={() => revealed.add(line)}
													>
														<ListChecksIcon />Alternativen festlegen
													</Button>
												{/if}
												<Button
													variant="ghost"
													size="sm"
													class="h-7 text-muted-foreground"
													aria-label="{kit.name} noch einmal mit anderer Auswahl hinzufügen"
													onclick={() => addCopy(line)}
												>
													<CopyPlusIcon />Weitere mit anderer Auswahl
												</Button>
											</div>
										{/if}
									</li>
								{/if}
							{/each}
						</ul>
					</Card.Content>
				</Card.Root>

				{#if shortages.length > 0}
					<Card.Root class="border-destructive">
						<Card.Header>
							<Card.Title class="text-destructive">Nicht genug Material</Card.Title>
						</Card.Header>
						<Card.Content>
							<ul class="space-y-1 text-sm">
								{#each shortages as text, index (index)}
									<li>{text}</li>
								{/each}
							</ul>
						</Card.Content>
					</Card.Root>
				{/if}

				<Card.Root>
					<Card.Header>
						<Card.Title>Benötigte Materialien</Card.Title>
						{#if needs.some((need) => need.byLine.length > 1)}
							<Card.Action class="flex items-center gap-2">
								<Switch id="show-breakdown" bind:checked={showBreakdown} />
								<Label for="show-breakdown" class="text-xs font-normal">Je Set</Label>
							</Card.Action>
						{/if}
					</Card.Header>
					<Card.Content>
						<ul class="space-y-2 text-sm">
							{#each needs as need (need.key)}
								<li class={need.missing > 0 ? 'text-destructive' : ''}>
									<div class="flex justify-between gap-2">
										<span><span class="tabular-nums">{need.required}×</span> {need.name}</span>
										<span
											class="shrink-0 text-xs tabular-nums {need.missing > 0
												? 'font-medium'
												: 'text-muted-foreground'}"
										>
											{need.missing > 0 ? missingText(need.missing) : `${need.available} verfügbar`}
										</span>
									</div>
									<p class="text-xs text-muted-foreground">
										{[need.place.location, need.place.detail].filter(Boolean).join(': ')}
									</p>
									{#if showBreakdown && need.byLine.length > 1}
										<ul class="mt-0.5 ml-1 border-l pl-2 text-xs text-muted-foreground">
											{#each need.byLine as part (part.line)}
												<li>
													<span class="tabular-nums">{part.pieces}×</span> für {labels[part.line]}
												</li>
											{/each}
										</ul>
									{/if}
								</li>
							{/each}
						</ul>
					</Card.Content>
				</Card.Root>
			{/if}
		</aside>
	</div>
</div>

<!-- On phones the packing list is below all kits; this bar jumps there. It sits above the bottom navigation. -->
{#if lines.length > 0}
	<div class="fixed inset-x-0 bottom-16 z-40 px-4 pb-2 sm:bottom-0 lg:hidden print:hidden">
		<Button href="#packliste" class="h-11 w-full shadow-lg">
			Packliste ({kitCount}
			{kitCount === 1 ? 'Set' : 'Sets'}){shortages.length > 0 ? ' · Material fehlt' : ''}
		</Button>
	</div>
{/if}

<!-- The printed packing list, grouped by where things are stored, to tick off while packing. -->
<section class="hidden space-y-4 text-sm text-black print:block">
	<header>
		<h1 class="text-xl font-bold">Packliste vom {formatDate(today())}</h1>
		<p>{selectedSummary}</p>
	</header>
	{#if shortages.length > 0}
		<div class="rounded border border-black p-2">
			<h2 class="font-semibold">Nicht genug Material</h2>
			<ul class="list-disc pl-5">
				{#each shortages as text, index (index)}<li>{text}</li>{/each}
			</ul>
		</div>
	{/if}
	{#each needsByLocation as [location, located] (location)}
		<div class="break-inside-avoid">
			<h2 class="border-b border-black font-semibold">{location}</h2>
			<ul>
				{#each located as need (need.key)}
					<li class="flex items-baseline gap-2 border-b border-gray-300 py-1">
						<span class="inline-block size-3.5 shrink-0 border border-black"></span>
						<span class="w-12 text-right tabular-nums">{need.required}×</span>
						<span class="flex-1">
							{need.name}
							{#if need.place.detail}<span class="text-gray-600">({need.place.detail})</span>{/if}
						</span>
						{#if need.missing > 0}<span class="font-semibold">{missingText(need.missing)}</span
							>{/if}
					</li>
				{/each}
			</ul>
		</div>
	{/each}
</section>
