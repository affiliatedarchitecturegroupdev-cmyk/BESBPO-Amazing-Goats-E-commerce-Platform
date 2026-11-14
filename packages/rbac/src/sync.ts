import { MATRIX } from './matrix';
import { PERMISSIONS } from './permissions';
import { ROLES } from './roles';

export interface RolePermissionPair {
  role: string;
  permission: string;
}

/** The role → permission pairs the code says should exist, in a stable order. */
export function rolePermissionPairs(): RolePermissionPair[] {
  return ROLES.flatMap((role) =>
    (MATRIX[role] ?? []).map((permission) => ({ role, permission })),
  );
}

/** The permission codes the code says should exist. */
export function permissionCodes(): string[] {
  return [...PERMISSIONS];
}

const sqlList = (values: string[]) => values.map((v) => `'${v.replace(/'/g, "''")}'`).join(',');

/**
 * Idempotent SQL that makes the database match `packages/rbac`: the role and
 * permission catalogues plus the role → permission mapping. Safe to run on
 * every deploy; existing rows are left alone, so it never drops data.
 */
export function rolePermissionSyncSql(): string {
  const roles = `INSERT INTO identity.roles(code) VALUES ${sqlList([...ROLES])} ON CONFLICT DO NOTHING;`;
  const perms = `INSERT INTO identity.permissions(code) VALUES ${sqlList(permissionCodes())} ON CONFLICT DO NOTHING;`;
  const pairs = rolePermissionPairs();
  const mapping = `INSERT INTO identity.role_permissions(role_code, permission_code) VALUES ${pairs
    .map((p) => `(${sqlList([p.role])},${sqlList([p.permission])})`)
    .join(',')} ON CONFLICT DO NOTHING;`;
  return [roles, perms, mapping].join('\n');
}

export interface RolePermissionDiff {
  toAdd: RolePermissionPair[];
  toRemove: RolePermissionPair[];
}

/**
 * What the sync would change: pairs in code but not the database (`toAdd`) and
 * pairs in the database but not code (`toRemove`). Used to report drift before
 * applying, and to prove the database is in step.
 */
export function diffRolePermissions(current: RolePermissionPair[]): RolePermissionDiff {
  const want = new Set(rolePermissionPairs().map((p) => `${p.role}\u0000${p.permission}`));
  const have = new Set(current.map((p) => `${p.role}\u0000${p.permission}`));
  const key = (p: RolePermissionPair) => `${p.role}\u0000${p.permission}`;
  return {
    toAdd: rolePermissionPairs().filter((p) => !have.has(key(p))),
    toRemove: current.filter((p) => !want.has(key(p))),
  };
}
