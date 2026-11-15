import { describe, it, expect } from 'vitest';
import { can, canAny, requiresSecondApprover } from './can';
import { PERMISSIONS } from './permissions';

describe('rbac', () => {
  it('chief admin holds every permission', () => {
    for (const p of PERMISSIONS) expect(can('chief_admin', p)).toBe(true);
  });
  it('drivers cannot see pricing or credit', () => {
    expect(can('driver', 'pricing:read')).toBe(false);
    expect(can('driver', 'credit:read')).toBe(false);
    expect(can('driver', 'delivery:execute')).toBe(true);
  });
  it('developers have no standing access to personal data', () => {
    expect(can('developer', 'pii:read')).toBe(false);
  });
  it('credit controllers cannot approve large limits themselves', () => {
    expect(can('credit_controller', 'credit:approve')).toBe(false);
    expect(can('executive', 'credit:approve')).toBe(true);
  });
  it('sensitive approvals need a second approver', () => {
    expect(requiresSecondApprover('roles:manage')).toBe(true);
    expect(requiresSecondApprover('orders:read')).toBe(false);
  });
  it('money approvals stay two-person', () => {
    expect(requiresSecondApprover('refunds:approve')).toBe(true);
    expect(requiresSecondApprover('payouts:approve')).toBe(true);
  });
  it('canAny checks several roles', () => {
    expect(canAny(['driver', 'dispatch'], 'routes:manage')).toBe(true);
  });
});
