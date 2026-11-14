import type { TenantRole } from '#lib/api/index.js';

export type Permission =
	| 'READ'
	| 'REPORT_DAMAGE'
	| 'BORROW'
	| 'WORK_ON_TASKS'
	| 'EDIT'
	| 'VIEW_MEMBERS'
	| 'MANAGE_MEMBERS';

// Mirrors the backend (auth/Access.kt), which enforces them; the UI only hides what a role can't do.
const viewer: Permission[] = ['READ', 'REPORT_DAMAGE', 'BORROW', 'WORK_ON_TASKS'];
const editor: Permission[] = [...viewer, 'EDIT', 'VIEW_MEMBERS'];
const permissions: Record<TenantRole, Permission[]> = {
	VIEWER: viewer,
	EDITOR: editor,
	ADMIN: [...editor, 'MANAGE_MEMBERS']
};

export function hasPermission(role: TenantRole, permission: Permission): boolean {
	return permissions[role].includes(permission);
}

export const roleLabels: Record<TenantRole, string> = {
	VIEWER: 'Lesen',
	EDITOR: 'Bearbeiten',
	ADMIN: 'Admin'
};

export const roleDescriptions: Record<TenantRole, string> = {
	VIEWER:
		'Sieht Material, Sets, Lagerorte und Aufgaben, leiht für sich selbst aus, kann Schäden melden und ihm zugewiesene Aufgaben bearbeiten und erledigen.',
	EDITOR:
		'Kann Material, Sets, Lagerorte und Aufgaben bearbeiten, sieht und verwaltet alle Ausleihen und sieht die Mitglieder.',
	ADMIN: 'Kann zusätzlich Mitglieder verwalten.'
};
