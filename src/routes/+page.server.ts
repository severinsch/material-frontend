
import { type Material } from '$lib/api';
import { apiClient } from '$lib/apiClient.ts';


export async function load(): Promise<{ materials: Material[] }> {
	const materials = await apiClient.materialsGet();
	return { materials };
}

