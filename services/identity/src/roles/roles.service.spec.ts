import { describe, it, expect } from 'vitest';
import { ROLES } from '@ag/rbac';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  it('lists the whole role matrix from @ag/rbac', () => {
    const rows = new RolesService().list();
    expect(rows.map((r) => r.role).sort()).toEqual([...ROLES].sort());
  });

  it('gives the chief administrator every permission', () => {
    const svc = new RolesService();
    const chief = svc.list().find((r) => r.role === 'chief_admin');
    expect(chief?.permissions.slice().sort()).toEqual(svc.permissions().slice().sort());
  });

  it('keeps a partner account to its own data', () => {
    const partner = new RolesService().list().find((r) => r.role === 'partner_user');
    expect(partner?.permissions).toEqual(['partner:own']);
  });

  it('returns the permission catalogue including roles:manage', () => {
    expect(new RolesService().permissions()).toContain('roles:manage');
  });
});
