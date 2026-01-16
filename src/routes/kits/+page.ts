import type { Kit, Material } from '$lib/api';
import { apiClient } from '$lib/apiClient.ts';

export async function load(): Promise<{ kits: Kit[]; materials: Material[] }> {
	const [kits, materials] = await Promise.all([
		apiClient.kitsGet(),
		apiClient.materialsGet()
	]);
	return { kits, materials };
}
