import type { Db } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import type { Role } from '@ag/rbac';
import { Membership, MemberRole, User, UserRoleGrant, UserStatus } from './users.types';
import { UsersStore } from './users.store';

interface UserRow {
  external_id: string;
  idp_subject: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  mfa_enrolled: boolean;
  status: UserStatus;
  marketing_opt_in: boolean;
  consent_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const USER_COLUMNS =
  'external_id, idp_subject, email, full_name, phone, mfa_enrolled, status, marketing_opt_in, consent_at, created_at, updated_at';

function toUser(row: UserRow): User {
  return {
    id: row.external_id,
    idpSubject: row.idp_subject,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    mfaEnrolled: row.mfa_enrolled,
    status: row.status,
    marketingOptIn: row.marketing_opt_in,
    consentAt: toIsoOrUndefined(row.consent_at) ?? null,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

/**
 * SQL adapter over `identity.users`, `identity.user_roles` and
 * `identity.org_members`. The domain id is a string (`usr_...`), so it is
 * carried in `external_id`; the roles and memberships reference the user's uuid.
 */
export class PgUsersStore implements UsersStore {
  constructor(private readonly db: Db) {}

  /** The uuid for a user's domain id, so the child rows can reference it. */
  private async uuidFor(tx: Db, externalId: string): Promise<string | undefined> {
    const { rows } = await tx.query<{ id: string }>(
      `SELECT id FROM identity.users WHERE external_id = $1`,
      [externalId],
    );
    return rows[0]?.id;
  }

  async all(): Promise<User[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<UserRow>(`SELECT ${USER_COLUMNS} FROM identity.users ORDER BY email`),
    );
    return rows.map(toUser);
  }

  async get(id: string): Promise<User | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<UserRow>(`SELECT ${USER_COLUMNS} FROM identity.users WHERE external_id = $1`, [id]),
    );
    return rows[0] ? toUser(rows[0]) : undefined;
  }

  async byEmail(email: string): Promise<User | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<UserRow>(`SELECT ${USER_COLUMNS} FROM identity.users WHERE email = $1`, [email]),
    );
    return rows[0] ? toUser(rows[0]) : undefined;
  }

  async save(user: User): Promise<User> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<UserRow>(
        `INSERT INTO identity.users
           (external_id, idp_subject, email, full_name, phone, mfa_enrolled, status,
            marketing_opt_in, consent_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (external_id) DO UPDATE SET
           idp_subject = EXCLUDED.idp_subject, email = EXCLUDED.email, full_name = EXCLUDED.full_name,
           phone = EXCLUDED.phone, mfa_enrolled = EXCLUDED.mfa_enrolled, status = EXCLUDED.status,
           marketing_opt_in = EXCLUDED.marketing_opt_in, consent_at = EXCLUDED.consent_at,
           updated_at = EXCLUDED.updated_at
         RETURNING ${USER_COLUMNS}`,
        [
          user.id,
          user.idpSubject,
          user.email,
          user.fullName,
          user.phone,
          user.mfaEnrolled,
          user.status,
          user.marketingOptIn,
          user.consentAt,
          user.createdAt,
          user.updatedAt,
        ],
      ),
    );
    return toUser(rows[0]);
  }

  async rolesFor(userId: string): Promise<Role[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ role_code: Role }>(
        `SELECT ur.role_code FROM identity.user_roles ur
           JOIN identity.users u ON u.id = ur.user_id
         WHERE u.external_id = $1 ORDER BY ur.role_code`,
        [userId],
      ),
    );
    return rows.map((r) => r.role_code);
  }

  async setRoles(
    userId: string,
    roles: Role[],
    grantedBy: string | null,
  ): Promise<UserRoleGrant[]> {
    const grantedAt = new Date().toISOString();
    const unique = [...new Set(roles)];
    await this.db.withSession(currentSession(), async (tx) => {
      const uuid = await this.uuidFor(tx, userId);
      if (!uuid) throw new Error(`user ${userId} not found`);
      await tx.query(`DELETE FROM identity.user_roles WHERE user_id = $1`, [uuid]);
      for (const role of unique) {
        await tx.query(
          `INSERT INTO identity.user_roles (user_id, role_code, granted_by_ref, granted_at)
           VALUES ($1, $2, $3, $4)`,
          [uuid, role, grantedBy, grantedAt],
        );
      }
    });
    return unique.map((role) => ({ userId, role, grantedBy, grantedAt, expiresAt: null }));
  }

  async roleGrants(userId: string): Promise<UserRoleGrant[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{
        role_code: Role;
        granted_by_ref: string | null;
        granted_at: Date | string;
        expires_at: Date | string | null;
      }>(
        `SELECT ur.role_code, ur.granted_by_ref, ur.granted_at, ur.expires_at
           FROM identity.user_roles ur
           JOIN identity.users u ON u.id = ur.user_id
         WHERE u.external_id = $1 ORDER BY ur.granted_at DESC`,
        [userId],
      ),
    );
    return rows.map((r) => ({
      userId,
      role: r.role_code,
      grantedBy: r.granted_by_ref,
      grantedAt: toIso(r.granted_at),
      expiresAt: toIsoOrUndefined(r.expires_at) ?? null,
    }));
  }

  async membershipsFor(userId: string): Promise<Membership[]> {
    return this.memberships('u.external_id = $1', [userId]);
  }

  async membersOf(orgId: string): Promise<Membership[]> {
    return this.memberships('o.external_id = $1', [orgId]);
  }

  private async memberships(where: string, values: unknown[]): Promise<Membership[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ org_ref: string; user_ref: string; member_role: MemberRole }>(
        `SELECT o.external_id AS org_ref, u.external_id AS user_ref, m.member_role
           FROM identity.org_members m
           JOIN identity.users u ON u.id = m.user_id
           JOIN identity.orgs o ON o.id = m.org_id
         WHERE ${where}`,
        values,
      ),
    );
    return rows.map((r) => ({ orgId: r.org_ref, userId: r.user_ref, memberRole: r.member_role }));
  }

  async saveMembership(membership: Membership): Promise<Membership> {
    await this.db.withSession(currentSession(), async (tx) => {
      await tx.query(
        `INSERT INTO identity.org_members (org_id, user_id, member_role)
         SELECT o.id, u.id, $3 FROM identity.orgs o, identity.users u
         WHERE o.external_id = $1 AND u.external_id = $2
         ON CONFLICT (org_id, user_id) DO UPDATE SET member_role = EXCLUDED.member_role`,
        [membership.orgId, membership.userId, membership.memberRole],
      );
    });
    return membership;
  }
}
