import { fail, redirect } from '@sveltejs/kit';
import { safeRedirectTarget } from '#lib/redirect.js';
import { callApi, errorMessage } from '#lib/server/api.js';
import { startSession } from '#lib/server/session.js';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals, url }) => {
	if (locals.user) redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
};

export const actions: Actions = {
	default: async ({ request, cookies, url, getClientAddress }) => {
		const form = await request.formData();
		const username = String(form.get('username') ?? '');
		const response = await callApi('auth/login', {
			method: 'POST',
			body: JSON.stringify({ username, password: String(form.get('password') ?? '') }),
			clientAddress: getClientAddress()
		});
		if (!response.ok)
			return fail(response.status, { username, message: await errorMessage(response) });
		startSession(cookies, await response.json());
		redirect(303, safeRedirectTarget(url.searchParams.get('redirectTo')));
	}
};
