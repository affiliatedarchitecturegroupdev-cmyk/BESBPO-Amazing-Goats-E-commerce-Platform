import { Role, ROLES, isStaff } from '@ag/rbac';
import { MemberRole, MemberRoleChange, OrgMembership, User, UserAdminError } from './users.types';

const MEMBER_ROLE_VALUES: readonly MemberRole[] = ['owner', 'admin', 'buyer', 'accounts'];

/** Only defined member roles can be assigned, so a typo cannot widen access. */
export function isMemberRole(value: string): value is MemberRole {
  return (MEMBER_ROLE_VALUES as readonly string[]).includes(value);
}

/** Only defined platform roles can be granted, mirroring the access module. */
export function isPlatformRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** The number of owners in an organisation. */
export function ownerCount(org: OrgMembership): number {
  return org.members.filter((m) => m.memberRole === 'owner').length;
}

/**
 * Enforce the invariants on a change to a member's organisation role:
 * - only real member roles may be assigned;
 * - the last owner cannot be demoted, so an org is never left unowned;
 * - an owner may not change their own role, so they cannot quietly remove
 *   their own accountability (another owner must do it).
 * Separation of duties across the two-person rule is handled by the access
 * module (`roles:manage`); this guards the org-membership invariants.
 */
export function assertRoleChange(org: OrgMembership, change: MemberRoleChange): void {
  if (!isMemberRole(change.to)) throw new UserAdminError(`unknown member role: ${change.to}`);
  if (!isMemberRole(change.from)) throw new UserAdminError(`unknown member role: ${change.from}`);

  const member = org.members.find((m) => m.userId === change.subjectId);
  if (!member) throw new UserAdminError('user is not a member of this organisation');

  if (change.from === 'owner' && change.to !== 'owner' && ownerCount(org) <= 1) {
    throw new UserAdminError('cannot remove the last owner');
  }

  if (change.from === 'owner' && change.subjectId === change.actorId) {
    throw new UserAdminError('an owner cannot change their own role');
  }
}

/** Apply an allowed change and return the updated membership list. */
export function applyMemberRoleChange(org: OrgMembership, change: MemberRoleChange): OrgMembership {
  assertRoleChange(org, change);
  return {
    ...org,
    members: org.members.map((m) =>
      m.userId === change.subjectId ? { ...m, memberRole: change.to } : m,
    ),
  };
}

/** Whether a user may sign in: only an active account with a verified subject. */
export function canSignIn(user: User): boolean {
  return user.status === 'active' && user.idpSubject.length > 0;
}

/**
 * Whether the account must still enrol a second factor. Staff need MFA
 * (`docs/02-access-control.md`); customers do not.
 */
export function requiresMfa(user: User, roles: readonly Role[]): boolean {
  return isStaff(roles) && !user.mfaEnrolled;
}

/** Whether a user is staff, from their platform roles. */
export function isStaffUser(roles: readonly Role[]): boolean {
  return isStaff(roles);
}

/** Normalise an email for comparison and storage. */
export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}
