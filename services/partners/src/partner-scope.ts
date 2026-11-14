import { ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '@ag/nest-auth';
import { canAny } from '@ag/rbac';

/**
 * The organisation a partner request acts for.
 *
 * A caller whose token carries an `orgId` is a partner: they are always scoped
 * to that organisation, so they can never read another partner's rows, even if
 * they ask for one. Internal procurement staff have no partner org and must
 * name the org they are acting for.
 */
export function partnerOrgId(user: AuthUser | undefined, requested?: string): string {
  if (!user) throw new ForbiddenException('not signed in');
  if (user.orgId) return user.orgId;
  if (canAny(user.roles, 'procurement:manage') && requested) return requested;
  throw new ForbiddenException('no partner organisation on the account');
}
