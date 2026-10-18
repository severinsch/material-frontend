import type { TenantRole } from '#lib/api/index.js';

export type Permission =
	'READ' | 'REPORT_DAMAGE' | 'BORROW' | 'EDIT' | 'VIEW_MEMBERS' | 'MANAGE_MEMBERS';

// Mirrors the backend (auth/Access.kt), which enforces them; the UI only hides what a role can't do.
const viewer: Permission[] = ['READ', 'REPORT_DAMAGE', 'BORROW'];
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
	VIEWER: 'Sieht Material, Sets und Lagerorte, leiht für sich selbst aus und kann Schäden melden.',
	EDITOR:
		'Kann Material, Sets und Lagerorte bearbeiten, sieht und verwaltet alle Ausleihen und sieht die Mitglieder.',
	ADMIN: 'Kann zusätzlich Mitglieder verwalten.'
};
