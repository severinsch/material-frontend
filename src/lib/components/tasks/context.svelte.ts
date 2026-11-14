import { createContext } from 'svelte';
import type { IndividualItem, Material, Member, Task } from '#lib/api/index.js';
import { targetsOf, type TaskTargets } from '#lib/tasks.js';

/** What the task components of a page need besides the task itself, provided by the page (see `provideTaskData`). */
export interface TaskData {
	/** All tasks the page loaded, for the history of recurring ones. */
	readonly tasks: Task[];
	readonly byId: ReadonlyMap<string, Task>;
	/** Materials and items that can be picked, and the names of linked ones. */
	readonly materials: Material[];
	readonly items: IndividualItem[];
	readonly targets: TaskTargets;
	/** Members that tasks can be assigned to; empty for viewers, who can't assign. */
	readonly members: Member[];
}

export const [getTaskData, setTaskData] = createContext<TaskData>();

/**
 * Provides [TaskData] to the task components of a page from its (reactive) data, and returns it for the page's own use
 * (e.g. its lookups). Call during component initialisation, with getters so the context follows reloads.
 */
export function provideTaskData(
	source: () => {
		tasks: Task[];
		materials: Material[];
		items: IndividualItem[];
		members?: Member[];
	}
): TaskData {
	// eslint-disable-next-line svelte/prefer-svelte-reactivity -- rebuilt as a whole, never mutated
	const byId = $derived(new Map(source().tasks.map((t) => [t.id, t])));
	const targets = $derived(targetsOf(source().materials, source().items));
	return setTaskData({
		get tasks() {
			return source().tasks;
		},
		get byId() {
			return byId;
		},
		get materials() {
			return source().materials;
		},
		get items() {
			return source().items;
		},
		get targets() {
			return targets;
		},
		get members() {
			return source().members ?? [];
		}
	});
}
