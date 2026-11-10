import { describe, expect, it } from 'vitest';
import { errorText } from './errors.js';

describe('errorText', () => {
	it('explains an unreachable server as a restart', () => {
		for (const status of [502, 503, 504]) {
			const text = errorText(status, 'Der Material-Server ist nicht erreichbar.');
			expect(text.title).toBe('Server kurz nicht erreichbar');
			expect(text.text).toContain('startet');
			expect(text.offerHome).toBe(false);
		}
	});

	it("replaces SvelteKit's English messages", () => {
		expect(errorText(404, 'Not Found').text).toContain('Diese Seite gibt es nicht');
		expect(errorText(500, 'Internal Error').text).toContain('unerwarteter Fehler');
		expect(errorText(403, undefined).text).toBe('Dafür fehlt dir die Berechtigung.');
	});

	it('keeps specific messages', () => {
		expect(errorText(404, 'Das Set gibt es nicht mehr.')).toEqual({
			title: 'Nicht gefunden',
			text: 'Das Set gibt es nicht mehr.',
			offerHome: true
		});
		expect(errorText(409, 'Die Materialien wurden inzwischen geändert.').text).toBe(
			'Die Materialien wurden inzwischen geändert.'
		);
	});

	it("offers the start page only where reloading alone won't help", () => {
		expect(errorText(404, undefined).offerHome).toBe(true);
		expect(errorText(400, undefined).offerHome).toBe(true);
		expect(errorText(500, undefined).offerHome).toBe(false);
	});
});
