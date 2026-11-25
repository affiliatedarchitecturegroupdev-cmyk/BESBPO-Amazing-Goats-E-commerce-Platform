import type { Role } from '@ag/rbac';
import { currentSession } from './auth-session';

/**
 * Roles for the signed-in staff member (T-059).
 *
 * This used to fall back to `['ops_manager']` when there was no session, which
 * handed every anonymous visitor an operations manager's permissions: the
 * navigation rendered in full and the pages behind it read staff data through
 * the gateway. An empty list is the only correct answer for "nobody is signed
 * in", and the middleware then redirects to sign-in.
 *
 * The answer is the gateway's, which verified the token, so a claim in a forged
 * cookie cannot widen the menu.
 */
export async function currentRoles(): Promise<Role[]> {
  const session = await currentSession();
  return (session?.user.roles as Role[] | undefined) ?? [];
}
