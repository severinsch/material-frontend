import { createTenantApi, unwrap } from '#lib/api/index.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, parent }) => {
	const api = createTenantApi((await parent()).tenant.id, fetch, url);
	const [kits, materials, items, tasks] = await Promise.all([
		unwrap(api.GET('/kits')),
		unwrap(api.GET('/materials')),
		// Individual materials are located by their items in the packing list.
		unwrap(api.GET('/items')),
		// Urgent open tasks are hinted at next to what they are about.
		unwrap(api.GET('/tasks', { params: { query: { open: true } } }))
	]);
	return { kits, materials, items, urgentTasks: tasks.filter((task) => task.urgent) };
};
