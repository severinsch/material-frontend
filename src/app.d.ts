// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { CurrentUser, ErrorCode } from '#lib/api/index.js';

declare global {
	namespace App {
		interface Error {
			message: string;
			/** Set for API errors that clients handle beyond showing the message, see `ErrorResponse`. */
			code?: ErrorCode;
		}
		interface Locals {
			/** The logged-in user, loaded by `hooks.server.ts` for every page request (always null in the API proxy). */
			user: CurrentUser | null;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
