import type { Role } from '@ag/rbac';

/**
 * Roles that belong to someone outside the company: a partner, an advertiser, a
 * household customer, or a trade account. Everyone else is staff.
 */
const EXTERNAL_ROLES: readonly Role[] = [
  'partner_user',
  'advertiser_user',
  'customer_household',
  'trade_owner',
  'trade_buyer',
  'trade_accounts',
];

/**
 * Whether the caller is staff, which decides the `app.staff` row-level-security
 * setting: staff bypass the org scope (they see every org), external users are
 * scoped to their own org. Kept as a pure function so the rule is testable and
 * there is one definition of "staff" for the session.
 */
export function isStaff(roles: readonly Role[]): boolean {
  if (roles.length === 0) return false;
  return roles.every((role) => !EXTERNAL_ROLES.includes(role));
}
