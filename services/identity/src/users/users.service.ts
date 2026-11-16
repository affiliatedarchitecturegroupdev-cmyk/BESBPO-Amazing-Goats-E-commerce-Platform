import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Role } from '@ag/rbac';
import { USERS_STORE, UsersStore } from './users.store';
import {
  MemberRole,
  Membership,
  OrgMembership,
  User,
  UserAdminError,
  UserRoleGrant,
  UserStatus,
} from './users.types';
import {
  applyMemberRoleChange,
  canSignIn,
  isPlatformRole,
  normaliseEmail,
  requiresMfa,
} from './users.rules';

/** Injection token for the clock, so tests can freeze time and ids. */
export const USERS_CLOCK = 'AG_USERS_CLOCK';

export interface CreateUserInput {
  idpSubject: string;
  email: string;
  fullName?: string | null;
  phone?: string | null;
}

export interface ChangeMemberRoleInput {
  orgId: string;
  subjectId: string;
  to: MemberRole;
}

/** A user with the roles, org memberships and access flags the admin screen needs. */
export interface UserDetail extends User {
  roles: Role[];
  memberships: Membership[];
  roleGrants: UserRoleGrant[];
  canSignIn: boolean;
  requiresMfa: boolean;
}

const STATUSES: readonly UserStatus[] = ['invited', 'active', 'suspended', 'disabled'];

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_STORE) private readonly store: UsersStore,
    @Optional() @Inject(USERS_CLOCK) private readonly now: () => Date = () => new Date(),
  ) {}

  /** Every account, ordered by email. */
  list(): Promise<User[]> {
    return this.store.all();
  }

  /** One account with its access detail. */
  async detail(id: string): Promise<UserDetail> {
    const user = await this.require(id);
    const roles = await this.store.rolesFor(id);
    return {
      ...user,
      roles,
      memberships: await this.store.membershipsFor(id),
      roleGrants: await this.store.roleGrants(id),
      canSignIn: canSignIn(user),
      requiresMfa: requiresMfa(user, roles),
    };
  }

  /** Create an account. The email is normalised; a duplicate is refused. */
  async create(input: CreateUserInput, _actorId: string): Promise<User> {
    const email = normaliseEmail(input.email);
    if (!email.includes('@')) throw new BadRequestException('a valid email is required');
    if (await this.store.byEmail(email)) throw new BadRequestException('email already registered');

    const at = this.now().toISOString();
    const user: User = {
      id: `usr_${this.now().getTime()}_${Math.random().toString(36).slice(2, 8)}`,
      idpSubject: input.idpSubject,
      email,
      fullName: input.fullName ?? null,
      phone: input.phone ?? null,
      mfaEnrolled: false,
      status: 'invited',
      marketingOptIn: false,
      consentAt: null,
      createdAt: at,
      updatedAt: at,
    };
    return this.store.save(user);
  }

  /** Change an account's status, e.g. activate an invite or suspend a user. */
  async setStatus(id: string, status: UserStatus): Promise<User> {
    if (!STATUSES.includes(status)) throw new BadRequestException(`unknown status: ${status}`);
    const user = await this.require(id);
    return this.store.save({ ...user, status, updatedAt: this.now().toISOString() });
  }

  /** The platform roles currently granted to a user. */
  rolesFor(id: string): Promise<Role[]> {
    return this.store.rolesFor(id);
  }

  /** Replace a user's platform roles. Every role must be a defined one. */
  async setRoles(id: string, roles: Role[], actorId: string): Promise<UserRoleGrant[]> {
    await this.require(id);
    const unknown = roles.filter((r) => !isPlatformRole(r));
    if (unknown.length > 0) throw new BadRequestException(`unknown roles: ${unknown.join(', ')}`);
    return this.store.setRoles(id, roles, actorId);
  }

  /** A user's organisation memberships. */
  membershipsFor(id: string): Promise<Membership[]> {
    return this.store.membershipsFor(id);
  }

  /**
   * Change a member's role in an organisation, enforcing the org invariants:
   * the last owner cannot be demoted and an owner cannot change their own role.
   */
  async changeMemberRole(input: ChangeMemberRoleInput, actorId: string): Promise<Membership[]> {
    const members = await this.store.membersOf(input.orgId);
    const member = members.find((m) => m.userId === input.subjectId);
    if (!member) throw new NotFoundException('user is not a member of this organisation');

    const org: OrgMembership = { orgId: input.orgId, members };
    let next: OrgMembership;
    try {
      next = applyMemberRoleChange(org, {
        orgId: input.orgId,
        subjectId: input.subjectId,
        from: member.memberRole,
        to: input.to,
        actorId,
      });
    } catch (err) {
      if (err instanceof UserAdminError) throw new BadRequestException(err.message);
      throw err;
    }
    for (const m of next.members) await this.store.saveMembership(m);
    return next.members;
  }

  private async require(id: string): Promise<User> {
    const user = await this.store.get(id);
    if (!user) throw new NotFoundException('user not found');
    return user;
  }
}
