import { describe, it, expect } from 'vitest';
import { ROLES, PERMISSIONS } from './index';
import { diffRolePermissions, rolePermissionPairs, rolePermissionSyncSql } from './sync';

describe('rolePermissionPairs', () => {
  it('covers every role in the matrix', () => {
    const roles = new Set(rolePermissionPairs().map((p) => p.role));
    expect([...roles].sort()).toEqual([...ROLES].sort());
  });

  it('only uses known roles and permissions', () => {
    for (const { role, permission } of rolePermissionPairs()) {
      expect(ROLES).toContain(role as never);
      expect(PERMISSIONS).toContain(permission as never);
    }
  });
});

describe('rolePermissionSyncSql', () => {
  const sql = rolePermissionSyncSql();
  it('inserts roles and permissions idempotently', () => {
    expect(sql).toContain('INSERT INTO identity.roles(code)');
    expect(sql).toContain('INSERT INTO identity.permissions(code)');
    expect(sql).toContain('ON CONFLICT DO NOTHING');
  });
  it('writes the role to permission mapping', () => {
    expect(sql).toContain('INSERT INTO identity.role_permissions(role_code, permission_code)');
    expect(sql).toContain("('partner_user','partner:own')");
    expect(sql).toContain("('chief_admin','catalog:read')");
  });
});

describe('diffRolePermissions', () => {
  it('reports nothing when the database matches the code', () => {
    const diff = diffRolePermissions(rolePermissionPairs());
    expect(diff).toEqual({ toAdd: [], toRemove: [] });
  });

  it('reports pairs missing from the database', () => {
    const diff = diffRolePermissions([{ role: 'partner_user', permission: 'partner:own' }]);
    expect(diff.toAdd).toContainEqual({ role: 'chief_admin', permission: 'catalog:read' });
    expect(diff.toRemove).toEqual([]);
  });

  it('reports pairs in the database that code no longer grants', () => {
    const diff = diffRolePermissions([{ role: 'driver', permission: 'orders:write' }]);
    expect(diff.toRemove).toContainEqual({ role: 'driver', permission: 'orders:write' });
  });
});
