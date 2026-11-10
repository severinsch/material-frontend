// What the error page says for an HTTP status. Messages come from SvelteKit (English defaults like "Not Found"), the
// API or the frontend's own `error(…)` calls (German).

export interface ErrorText {
	title: string;
	text: string;
	/** Whether a link to the start page helps, i.e. reloading alone won't. */
	offerHome: boolean;
}

/** SvelteKit's own messages, which are English and say nothing beyond the status. */
const genericMessages = new Set(['Not Found', 'Internal Error', 'Forbidden', 'Bad Request']);

/** The title and text of the error page for [status] and the error's [message]. */
export function errorText(status: number, message: string | undefined): ErrorText {
	const specific = message && !genericMessages.has(message) ? message : undefined;
	// The API (or the frontend in front of it) is restarting, e.g. after an update.
	if (status === 502 || status === 503 || status === 504) {
		return {
			title: 'Server kurz nicht erreichbar',
			text: 'Wahrscheinlich startet der Server gerade neu, etwa nach einem Update. Das dauert meist nur einen Moment: Lade die Seite gleich noch einmal.',
			offerHome: false
		};
	}
	if (status === 404) {
		return {
			title: 'Nicht gefunden',
			text:
				specific ??
				'Diese Seite gibt es nicht (mehr). Vielleicht ist der Link veraltet oder das Angezeigte wurde inzwischen gelöscht.',
			offerHome: true
		};
	}
	if (status === 403) {
		return {
			title: 'Keine Berechtigung',
			text: specific ?? 'Dafür fehlt dir die Berechtigung.',
			offerHome: true
		};
	}
	if (status >= 400 && status < 500) {
		return {
			title: 'Das hat nicht geklappt',
			text: specific ?? 'Die Anfrage konnte nicht bearbeitet werden. Lade die Seite neu.',
			offerHome: true
		};
	}
	return {
		title: 'Etwas ist schiefgegangen',
		text:
			specific ??
			'Ein unerwarteter Fehler ist aufgetreten. Lade die Seite neu. Wenn es wieder passiert, sag dem Admin Bescheid.',
		offerHome: false
	};
}
