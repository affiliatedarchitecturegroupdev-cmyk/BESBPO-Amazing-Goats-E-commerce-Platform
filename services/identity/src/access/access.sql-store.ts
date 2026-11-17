import type { Db } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import type { Role } from '@ag/rbac';
import { ElevationRequest, RoleChange } from './access-domain';
import { AccessStore } from './access.store';

interface RoleChangeRow {
  external_id: string;
  subject_id: string;
  from_roles: Role[];
  to_roles: Role[];
  requested_by: string;
  approved_by: string | null;
  created_at: Date | string;
}

interface ElevationRow {
  external_id: string;
  subject_ref: string;
  role: Role;
  reason: string;
  requested_by_ref: string;
  minutes: number;
  created_at: Date | string;
  ends_at: Date | string | null;
  approved_by_ref: string | null;
}

const ROLE_CHANGE_COLUMNS =
  'external_id, subject_id, from_roles, to_roles, requested_by, approved_by, created_at';
const ELEVATION_COLUMNS =
  'external_id, subject_ref, role, reason, requested_by_ref, minutes, created_at, ends_at, approved_by_ref';

function toRoleChange(row: RoleChangeRow): RoleChange {
  return {
    id: row.external_id,
    subjectId: row.subject_id,
    from: row.from_roles,
    to: row.to_roles,
    requestedBy: row.requested_by,
    ...(row.approved_by ? { approvedBy: row.approved_by } : {}),
    createdAt: toIso(row.created_at),
  };
}

function toElevation(row: ElevationRow): ElevationRequest {
  return {
    id: row.external_id,
    subjectId: row.subject_ref,
    role: row.role,
    reason: row.reason,
    requestedBy: row.requested_by_ref,
    minutes: row.minutes,
    createdAt: toIso(row.created_at),
    expiresAt: toIsoOrUndefined(row.ends_at) ?? '',
    ...(row.approved_by_ref ? { approvedBy: row.approved_by_ref } : {}),
  };
}

/**
 * SQL adapter for the access workflow. Role changes live in the new
 * `identity.role_change_requests`; elevations in `identity.elevation_requests`,
 * whose `permission` column keeps its NOT NULL and is written with the role.
 * The current role set (`rolesFor`/`setRoles`) is over `identity.user_roles`,
 * keyed by the subject's uuid resolved from its domain id.
 */
export class PgAccessStore implements AccessStore {
  constructor(private readonly db: Db) {}

  private async uuidFor(tx: Db, externalId: string): Promise<string | undefined> {
    const { rows } = await tx.query<{ id: string }>(
      `SELECT id FROM identity.users WHERE external_id = $1`,
      [externalId],
    );
    return rows[0]?.id;
  }

  async roleChange(id: string): Promise<RoleChange | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RoleChangeRow>(
        `SELECT ${ROLE_CHANGE_COLUMNS} FROM identity.role_change_requests WHERE external_id = $1`,
        [id],
      ),
    );
    return rows[0] ? toRoleChange(rows[0]) : undefined;
  }

  async roleChanges(): Promise<RoleChange[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RoleChangeRow>(
        `SELECT ${ROLE_CHANGE_COLUMNS} FROM identity.role_change_requests ORDER BY created_at DESC`,
      ),
    );
    return rows.map(toRoleChange);
  }

  async saveRoleChange(change: RoleChange): Promise<RoleChange> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RoleChangeRow>(
        `INSERT INTO identity.role_change_requests
           (external_id, subject_id, from_roles, to_roles, requested_by, approved_by, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (external_id) DO UPDATE SET approved_by = EXCLUDED.approved_by
         RETURNING ${ROLE_CHANGE_COLUMNS}`,
        [
          change.id,
          change.subjectId,
          change.from,
          change.to,
          change.requestedBy,
          change.approvedBy ?? null,
          change.createdAt,
        ],
      ),
    );
    return toRoleChange(rows[0]);
  }

  async rolesFor(subjectId: string): Promise<Role[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ role_code: Role }>(
        `SELECT ur.role_code FROM identity.user_roles ur
           JOIN identity.users u ON u.id = ur.user_id
         WHERE u.external_id = $1 ORDER BY ur.role_code`,
        [subjectId],
      ),
    );
    return rows.map((r) => r.role_code);
  }

  async setRoles(subjectId: string, roles: Role[]): Promise<void> {
    await this.db.withSession(currentSession(), async (tx) => {
      const uuid = await this.uuidFor(tx, subjectId);
      if (!uuid) throw new Error(`user ${subjectId} not found`);
      await tx.query(`DELETE FROM identity.user_roles WHERE user_id = $1`, [uuid]);
      for (const role of [...new Set(roles)]) {
        await tx.query(`INSERT INTO identity.user_roles (user_id, role_code) VALUES ($1, $2)`, [
          uuid,
          role,
        ]);
      }
    });
  }

  async elevation(id: string): Promise<ElevationRequest | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ElevationRow>(
        `SELECT ${ELEVATION_COLUMNS} FROM identity.elevation_requests WHERE external_id = $1`,
        [id],
      ),
    );
    return rows[0] ? toElevation(rows[0]) : undefined;
  }

  async saveElevation(req: ElevationRequest): Promise<ElevationRequest> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ElevationRow>(
        `INSERT INTO identity.elevation_requests
           (external_id, subject_ref, role, permission, reason, requested_by_ref, approved_by_ref,
            minutes, created_at, ends_at)
         VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (external_id) DO UPDATE SET approved_by_ref = EXCLUDED.approved_by_ref
         RETURNING ${ELEVATION_COLUMNS}`,
        [
          req.id,
          req.subjectId,
          req.role,
          req.reason,
          req.requestedBy,
          req.approvedBy ?? null,
          req.minutes,
          req.createdAt,
          req.expiresAt,
        ],
      ),
    );
    return toElevation(rows[0]);
  }

  async elevations(): Promise<ElevationRequest[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ElevationRow>(
        `SELECT ${ELEVATION_COLUMNS} FROM identity.elevation_requests ORDER BY created_at DESC`,
      ),
    );
    return rows.map(toElevation);
  }
}
