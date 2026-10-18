import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url }) => {
	// Reading the path makes this rerun on every navigation, with the user just loaded by the hook. So changes by an
	// admin (memberships, roles) take effect without reloading the page.
	void url.pathname;
	return { user: locals.user };
};
