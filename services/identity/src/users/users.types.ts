import { Role } from '@ag/rbac';

/** Account state. `invited` has not accepted yet; `disabled` may not sign in. */
export type UserStatus = 'invited' | 'active' | 'suspended' | 'disabled';

/** A person's role inside an organisation, from `identity.org_members`. */
export type MemberRole = 'owner' | 'admin' | 'buyer' | 'accounts';

export const MEMBER_ROLES: readonly MemberRole[] = ['owner', 'admin', 'buyer', 'accounts'];

/** A platform account, from `identity.users`. */
export interface User {
  id: string;
  idpSubject: string;
  email: string;
  fullName: string | null;
  phone: string | null;
  mfaEnrolled: boolean;
  status: UserStatus;
  marketingOptIn: boolean;
  consentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A user's membership of an organisation, from `identity.org_members`. */
export interface Membership {
  orgId: string;
  userId: string;
  memberRole: MemberRole;
}

/** A platform role granted to a user, from `identity.user_roles`. */
export interface UserRoleGrant {
  userId: string;
  role: Role;
  grantedBy: string | null;
  grantedAt: string;
  expiresAt: string | null;
}

/** An organisation and its members, the scope a role change is checked against. */
export interface OrgMembership {
  orgId: string;
  members: Membership[];
}

/** A request to change one member's role in an organisation. */
export interface MemberRoleChange {
  orgId: string;
  subjectId: string;
  from: MemberRole;
  to: MemberRole;
  /** The signed-in user making the change. */
  actorId: string;
}

/** Thrown by the rules when a change would break an invariant. */
export class UserAdminError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserAdminError';
  }
}
