import { cookies } from 'next/headers';
import type { Role } from '@ag/rbac';
import { rolesFromCookie, SESSION_COOKIE } from './roles';

export { SESSION_COOKIE, rolesFromCookie };

/**
 * Roles for the signed-in staff member. Until the identity provider lands
 * (T-004/T-005), the demo reads an `ag_roles` cookie and falls back to an
 * operations manager, so the permission-driven menu can be seen end to end.
 */
export function currentRoles(): Role[] {
  const roles = rolesFromCookie(cookies().get(SESSION_COOKIE)?.value);
  return roles.length > 0 ? roles : ['ops_manager'];
}
