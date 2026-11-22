// The state of the Schnellerfassung page: where the person is, saving and undoing entries. What an entry does is
// [planEntry] in `#lib/quick-entry.ts`.

import { refreshAll } from '$app/navigation';
import type {
	IndividualItem,
	Material,
	NewQuickEntry,
	QuickEntryResult,
	TenantApi,
	Variant
} from '#lib/api/index.js';
import { mutate } from '#lib/api/index.js';
import { variantName } from '#lib/format.js';
import { planEntry, type Draft, type Plan } from '#lib/quick-entry.js';

export { emptyDraft, type Draft, type Kind, type Plan } from '#lib/quick-entry.js';

export interface HistoryEntry {
	key: number;
	label: string;
	result: QuickEntryResult;
	identifiers: string[];
}

export class QuickSession {
	locationId = $state('');
	place = $state('');
	/** Whether the location line was shown open once (see `QuickHere`). */
	locationAsked = false;
	/** Carried over from the last new material. */
	category = $state('');
	history: HistoryEntry[] = $state([]);
	/** While a save runs; the inputs don't save twice. */
	saving = $state(false);
	/** Puts the focus back into the active input after a click elsewhere (set by that input). */
	focusInput: () => void = () => {};
	private keys = 0;

	constructor(
		private readonly api: () => TenantApi,
		private readonly data: () => { materials: Material[]; items: IndividualItem[] }
	) {}

	get materials() {
		return this.data().materials;
	}

	plan(draft: Draft): Plan {
		return planEntry(this.materials, this.data().items, draft);
	}

	/**
	 * Saves [draft]; [onSaved] runs as soon as the API answers, before the page data reloads, so the input can be
	 * cleared before anything new is typed into it. After a 409 (e.g. someone created the name meanwhile) the data
	 * reloads too, so the input shows what the entry adds to now.
	 */
	async save(draft: Draft, onSaved: () => void): Promise<void> {
		const plan = this.plan(draft);
		if (plan.problem !== null || this.saving) return;
		const where = {
			storageLocationId: this.locationId || null,
			locationDetail: this.place.trim() || null
		};
		const amount = plan.kind === 'BULK' ? { count: plan.count } : { identifiers: plan.identifiers };
		const body: NewQuickEntry =
			plan.match.kind === 'existing'
				? { variantId: plan.match.variant.id, trackingType: plan.kind, ...amount, ...where }
				: {
						name: draft.name.trim(),
						trackingType: plan.kind,
						category: draft.category.trim() || null,
						...amount,
						...where
					};
		const identifiers = plan.identifiers;
		this.saving = true;
		await mutate(this.api().POST('/quick-entries', { body }), null, {
			onSuccess: (result) => {
				const variant = (result.material.variants as Variant[]).find(
					(v) => v.id === result.variantId
				);
				this.history.unshift({
					key: ++this.keys,
					label: variant ? variantName(result.material, variant) : result.material.name,
					result,
					identifiers
				});
				if (result.created) this.category = result.material.category ?? '';
				onSaved();
			},
			onError: (_, status) => {
				if (status === 409) void refreshAll();
				return false;
			}
		});
		this.saving = false;
		this.focusInput();
	}

	/** The entry leaves the history at once, so a second click can't undo it twice; it comes back on failure. */
	async undo(entry: HistoryEntry) {
		const index = this.history.indexOf(entry);
		if (index < 0) return;
		this.history.splice(index, 1);
		const { variantId, created, count, itemIds } = entry.result;
		const done = await mutate(
			this.api().POST('/quick-entries/undo', { body: { variantId, created, count, itemIds } }),
			`${entry.label} rückgängig gemacht`
		);
		if (!done) this.history.splice(Math.min(index, this.history.length), 0, entry);
		this.focusInput();
	}
}
