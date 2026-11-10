<script lang="ts">
	import ArrowLeftIcon from '@lucide/svelte/icons/arrow-left';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import PrinterIcon from '@lucide/svelte/icons/printer';
	import { formatDate, formatPrice, today } from '#lib/format.js';
	import {
		formatYears,
		inventoryReport,
		reportCsv,
		valueNote,
		type ReportLine
	} from '#lib/report.js';
	import { getTenant } from '#lib/tenant.js';
	import { Button } from '#lib/components/ui/button/index.js';

	let { data } = $props();

	const tenant = getTenant();
	const report = $derived(inventoryReport(data.materials, data.items, data.purchases));
	const date = today();
	const totals = $derived(report.totals);

	const numberFormat = new Intl.NumberFormat('de-DE');
	const count = (value: number) => numberFormat.format(value);

	// Appended to the totals' values in the summary; built here, since a block in the markup would drop the space.
	const unpricedItems = $derived(
		totals.items.priced < totals.items.count
			? ` – Preis für ${count(totals.items.priced)} von ${count(totals.items.count)} erfasst`
			: ''
	);

	/** E.g. "0,35 €" or "0,35–0,40 €". */
	function priceRange(line: ReportLine) {
		if (!line.prices) return '—';
		const { min, max } = line.prices;
		return min === max ? formatPrice(min) : `${formatPrice(min)} – ${formatPrice(max)}`;
	}

	/** A value, or "—" if no price is known. */
	function value(value: number | null) {
		return value != null ? formatPrice(value) : '—';
	}

	function downloadCsv() {
		const blob = new Blob([reportCsv(report)], { type: 'text/csv;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `Inventarliste ${tenant.tenant.name} ${date}.csv`;
		link.click();
		// Some browsers start the download only after the click handler; the URL must still be valid then.
		setTimeout(() => URL.revokeObjectURL(url), 10_000);
	}
</script>

<!-- Also the name of a PDF saved from the print dialog. -->
<svelte:head><title>Inventarliste {tenant.tenant.name} {date}</title></svelte:head>

<!-- [withNote]: whether to say what the value is based on; the variants of a material say it for themselves. -->
{#snippet lineCells(line: ReportLine, indented: boolean, withNote: boolean)}
	{@const note = withNote ? valueNote(line) : ''}
	<td class={['py-1.5 pr-3 align-top wrap-break-word hyphens-auto', indented && 'pl-4']}>
		<span class={indented ? '' : 'font-medium'}>{line.name}</span>
		<!-- On phones, the columns for years and prices are hidden and shown here instead. -->
		{#if line.years.length > 0 || line.prices}
			<span class="block text-xs text-muted-foreground sm:hidden print:hidden">
				{[formatYears(line.years), line.prices && `je ${priceRange(line)}`]
					.filter(Boolean)
					.join(' · ')}
			</span>
		{/if}
	</td>
	<td class="py-1.5 pr-3 text-right align-top tabular-nums">{count(line.count)}</td>
	<td class="hidden py-1.5 pr-3 align-top sm:table-cell print:table-cell">
		{formatYears(line.years) || '—'}
	</td>
	<td class="hidden py-1.5 pr-3 text-right align-top tabular-nums sm:table-cell print:table-cell">
		{priceRange(line)}
	</td>
	<td class="py-1.5 text-right align-top tabular-nums">
		{value(line.value)}
		{#if note}
			<span class="block text-xs text-muted-foreground print:text-gray-600">{note}</span>
		{/if}
	</td>
{/snippet}

<div class="space-y-6 print:space-y-4 print:text-sm print:text-black">
	<div class="space-y-4 print:hidden">
		<a
			href={tenant.href('')}
			class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
		>
			<ArrowLeftIcon class="size-4" />Materialien
		</a>
	</div>

	<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight print:text-xl">Inventarliste</h1>
			<p class="text-muted-foreground print:text-black">
				{tenant.tenant.name} · Stand {formatDate(date)}
			</p>
		</div>
		<div class="flex flex-wrap gap-2 print:hidden">
			<Button onclick={() => window.print()}><PrinterIcon />Drucken</Button>
			<Button variant="outline" onclick={downloadCsv}><DownloadIcon />CSV</Button>
		</div>
	</header>

	<section class="space-y-3 print:break-inside-avoid" aria-label="Zusammenfassung">
		<dl class="grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div class="rounded-md border p-3 print:border-black print:p-2">
				<dt class="text-sm text-muted-foreground print:text-black">Materialien</dt>
				<dd class="text-2xl font-semibold tabular-nums print:text-lg">
					{count(totals.materials)}
				</dd>
			</div>
			<div class="rounded-md border p-3 print:border-black print:p-2">
				<dt class="text-sm text-muted-foreground print:text-black">Stück</dt>
				<dd class="text-2xl font-semibold tabular-nums print:text-lg">{count(totals.count)}</dd>
			</div>
			<div class="col-span-2 rounded-md border p-3 sm:col-span-1 print:border-black print:p-2">
				<dt class="text-sm text-muted-foreground print:text-black">Kaufwert, soweit erfasst</dt>
				<dd class="text-2xl font-semibold tabular-nums print:text-lg">
					{value(totals.items.value)}
				</dd>
			</div>
		</dl>
		<ul class="space-y-1 text-sm text-muted-foreground print:text-black">
			{#if totals.items.count > 0}
				<li>
					<span class="font-medium text-foreground print:text-black">Einzeln erfasst</span>
					(z. B. Zelte): {count(totals.items.count)} Gegenstände,
					{#if totals.items.priced === 0}
						kein Kaufpreis erfasst.
					{:else}
						Kaufwert {value(totals.items.value)}{unpricedItems}.
					{/if}
				</li>
			{/if}
			<li>
				Kaufwert nur für einzeln erfasste Gegenstände, ohne Abschreibung. Nicht enthalten sind
				archivierte Materialien und ausgemusterte oder verlorene Gegenstände.
			</li>
		</ul>
	</section>

	{#each report.categories as category (category.name)}
		<section class="space-y-2">
			<h2 class="border-b pb-1 text-lg font-semibold print:border-black print:text-base">
				{category.name || 'Ohne Kategorie'}
			</h2>
			<!-- Fixed column widths, so the columns line up across the categories' tables (T-20). -->
			<table class="w-full table-fixed text-sm">
				<thead class="text-left text-xs text-muted-foreground print:text-black">
					<tr>
						<th class="py-1 pr-3 font-medium">Material</th>
						<th class="w-18 py-1 pr-3 text-right font-medium sm:w-[10%] print:w-[10%]">Anzahl</th>
						<th class="hidden w-[15%] py-1 pr-3 font-medium sm:table-cell print:table-cell">
							Gekauft
						</th>
						<th
							class="hidden w-[17%] py-1 pr-3 text-right font-medium sm:table-cell print:table-cell"
						>
							Stückpreis
						</th>
						<th class="w-24 py-1 text-right font-medium sm:w-[22%] print:w-[22%]">Kaufwert</th>
					</tr>
				</thead>
				{#each category.materials as material (material.key)}
					<!-- A body per material keeps it together with its variants across page breaks. -->
					<tbody class="border-t print:break-inside-avoid print:border-gray-300">
						<tr>{@render lineCells(material, false, material.variants.length === 0)}</tr>
						{#each material.variants as variant (variant.key)}
							<tr class="text-muted-foreground print:text-black">
								{@render lineCells(variant, true, true)}
							</tr>
						{/each}
					</tbody>
				{/each}
				<tfoot class="border-t-2 font-medium print:border-black">
					<tr>
						<td class="py-1.5 pr-3">Summe</td>
						<td class="py-1.5 pr-3 text-right tabular-nums">{count(category.totals.count)}</td>
						<td class="hidden sm:table-cell print:table-cell"></td>
						<td class="hidden sm:table-cell print:table-cell"></td>
						<td class="py-1.5 text-right tabular-nums">
							{value(category.totals.items.value)}
						</td>
					</tr>
				</tfoot>
			</table>
		</section>
	{:else}
		<p class="text-muted-foreground">Noch keine Materialien.</p>
	{/each}
</div>
