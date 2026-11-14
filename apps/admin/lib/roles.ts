import { ROLES, type Role } from '@ag/rbac';

export const SESSION_COOKIE = 'ag_roles';

/** Keep only the role names we recognise, so a stray value cannot widen access. */
export function rolesFromCookie(raw: string | undefined): Role[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((role) => role.trim())
    .filter((role): role is Role => (ROLES as readonly string[]).includes(role));
}
