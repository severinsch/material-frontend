// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { CurrentUser } from '#lib/api/index.js';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** The logged-in user, loaded by `hooks.server.ts` for every page request (not for the API proxy). */
			user: CurrentUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
