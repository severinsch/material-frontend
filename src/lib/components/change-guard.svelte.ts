const serialize = (value: unknown) => JSON.stringify($state.snapshot(value)) ?? '';

/**
 * Protects a form in a dialog: while it saves, and once its values differ from when it opened, Escape or a tap outside
 * don't close the dialog; with changes, [confirming] asks whether to discard them (see `ConfirmDiscard`). "Abbrechen"
 * and the close button discard without asking, since they say so.
 */
export class ChangeGuard {
	saving = $state(false);
	confirming = $state(false);
	/** The values as they were when the form opened. */
	#initial = '';
	/** Counts the openings of the form, so a save that ends after the form was closed or opened anew is told apart. */
	#session = 0;
	readonly #values: () => unknown;

	/** [values] returns the edited values (state, compared as JSON). */
	constructor(values: () => unknown) {
		this.#values = values;
	}

	/** Takes the current values as unchanged; call when the form opens, once its values are set. */
	start() {
		this.#session++;
		this.#initial = serialize(this.#values());
		this.saving = false;
		this.confirming = false;
	}

	/** For the dialog content's `onEscapeKeydown` and `onInteractOutside`. */
	intercept = (event: Event) => {
		if (this.saving) {
			event.preventDefault();
		} else if (serialize(this.#values()) !== this.#initial) {
			event.preventDefault();
			this.confirming = true;
		}
	};

	/**
	 * Runs [save] with [saving] set, unless a save is running already (e.g. a double click). Returns whether it saved
	 * and the form is still the one it saved, i.e. whether to close it.
	 */
	async save(save: () => Promise<boolean>): Promise<boolean> {
		if (this.saving) return false;
		const session = this.#session;
		this.saving = true;
		try {
			return (await save()) && session === this.#session;
		} finally {
			if (session === this.#session) this.saving = false;
		}
	}
}
