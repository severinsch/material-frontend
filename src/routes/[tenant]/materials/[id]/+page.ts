import { createTenantApi, unwrap } from '#lib/api/index.js';
import { hasPermission } from '#lib/permissions.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, url, params, parent }) => {
	const { tenant } = await parent();
	const api = createTenantApi(tenant.id, fetch, url);
	const byMaterial = { params: { query: { materialId: params.id } } };
	const canEdit = hasPermission(tenant.role, 'EDIT');
	const [material, locations, allItems, purchases, damages, materials, tasks, members] =
		await Promise.all([
			unwrap(api.GET('/materials/{id}', { params: { path: { id: params.id } } })),
			unwrap(api.GET('/locations')),
			// All of them: tasks can be about items of other materials too.
			unwrap(api.GET('/items')),
			unwrap(api.GET('/purchases', byMaterial)),
			unwrap(api.GET('/damages')),
			// For the material dialog's categories, and the names of what tasks are about.
			unwrap(api.GET('/materials')),
			unwrap(api.GET('/tasks', byMaterial)),
			// Only editors assign tasks.
			canEdit ? unwrap(api.GET('/members')) : []
		]);
	const items = allItems.filter((item) => item.materialId === params.id);
	const itemIds = new Set(items.map((item) => item.id));
	return {
		material,
		locations,
		items,
		allItems,
		purchases,
		materials,
		tasks,
		members,
		damages: damages.filter((d) => itemIds.has(d.itemId))
	};
};
