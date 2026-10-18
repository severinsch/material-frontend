import { redirect } from '@sveltejs/kit';
import { callApi } from '#lib/server/api.js';
import { endSession, sessionToken } from '#lib/server/session.js';
import type { Actions, PageServerLoad } from './$types';

// Logging out is a POST (a form in the user menu), so links and prefetching can't end the session.
export const load: PageServerLoad = () => redirect(303, '/');

export const actions: Actions = {
	default: async ({ cookies }) => {
		const token = sessionToken(cookies);
		// The cookie goes in any case, even if the API can't end the session now (it expires on its own).
		endSession(cookies);
		if (token) await callApi('auth/logout', { method: 'POST', token }).catch(() => undefined);
		redirect(303, '/login');
	}
};
