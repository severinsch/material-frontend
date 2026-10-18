import { fail, redirect } from '@sveltejs/kit';
import type { SetupInfo } from '#lib/api/index.js';
import { callApi, errorMessage } from '#lib/server/api.js';
import { startSession } from '#lib/server/session.js';
import type { Actions } from './$types';

// The setup link carries its token in the URL fragment (`/setup#<token>`), which browsers never send to servers, so it
// doesn't end up in logs or referrers. The page reads it and sends it to these actions.
export const actions: Actions = {
	inspect: async ({ request }) => {
		const token = String((await request.formData()).get('token') ?? '');
		const response = await callApi('auth/setup/inspect', {
			method: 'POST',
			body: JSON.stringify({ token })
		});
		if (!response.ok) return fail(response.status, { message: await errorMessage(response) });
		return { info: (await response.json()) as SetupInfo };
	},
	complete: async ({ request, cookies }) => {
		const form = await request.formData();
		const body = JSON.stringify({
			token: String(form.get('token') ?? ''),
			password: String(form.get('password') ?? '')
		});
		const response = await callApi('auth/setup', { method: 'POST', body });
		if (!response.ok) return fail(response.status, { message: await errorMessage(response) });
		startSession(cookies, await response.json());
		redirect(303, '/');
	}
};
