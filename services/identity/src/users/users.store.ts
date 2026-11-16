import { Role } from '@ag/rbac';
import { Membership, User, UserRoleGrant } from './users.types';

export const USERS_STORE = Symbol('USERS_STORE');

/**
 * Persistence boundary for `identity.users`, `identity.user_roles` and
 * `identity.org_members`. The default is in-memory; the SQL adapter lands with
 * the store swap (T-047).
 */
export interface UsersStore {
  all(): Promise<User[]>;
  get(id: string): Promise<User | undefined>;
  byEmail(email: string): Promise<User | undefined>;
  save(user: User): Promise<User>;

  rolesFor(userId: string): Promise<Role[]>;
  setRoles(userId: string, roles: Role[], grantedBy: string | null): Promise<UserRoleGrant[]>;
  roleGrants(userId: string): Promise<UserRoleGrant[]>;

  membershipsFor(userId: string): Promise<Membership[]>;
  membersOf(orgId: string): Promise<Membership[]>;
  saveMembership(membership: Membership): Promise<Membership>;
}

export class InMemoryUsersStore implements UsersStore {
  private readonly users = new Map<string, User>();
  private readonly grants = new Map<string, UserRoleGrant[]>();
  private readonly memberships = new Map<string, Membership>(); // `${orgId}:${userId}`

  constructor(seed: User[] = []) {
    for (const user of seed) this.users.set(user.id, user);
  }

  async all(): Promise<User[]> {
    return [...this.users.values()].sort((a, b) => a.email.localeCompare(b.email));
  }

  async get(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async byEmail(email: string): Promise<User | undefined> {
    return [...this.users.values()].find((u) => u.email === email);
  }

  async save(user: User): Promise<User> {
    this.users.set(user.id, user);
    return user;
  }

  async rolesFor(userId: string): Promise<Role[]> {
    return (this.grants.get(userId) ?? []).map((g) => g.role);
  }

  async setRoles(userId: string, roles: Role[], grantedBy: string | null): Promise<UserRoleGrant[]> {
    const grantedAt = new Date().toISOString();
    const grants: UserRoleGrant[] = [...new Set(roles)].map((role) => ({
      userId,
      role,
      grantedBy,
      grantedAt,
      expiresAt: null,
    }));
    this.grants.set(userId, grants);
    return grants;
  }

  async roleGrants(userId: string): Promise<UserRoleGrant[]> {
    return this.grants.get(userId) ?? [];
  }

  async membershipsFor(userId: string): Promise<Membership[]> {
    return [...this.memberships.values()].filter((m) => m.userId === userId);
  }

  async membersOf(orgId: string): Promise<Membership[]> {
    return [...this.memberships.values()].filter((m) => m.orgId === orgId);
  }

  async saveMembership(membership: Membership): Promise<Membership> {
    this.memberships.set(`${membership.orgId}:${membership.userId}`, membership);
    return membership;
  }
}
