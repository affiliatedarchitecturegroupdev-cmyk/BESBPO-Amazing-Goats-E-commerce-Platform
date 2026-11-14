import { describe, it, expect } from 'vitest';
import {
  applyRoleChange,
  canApplyRoleChange,
  canRequestElevation,
  elevationAlert,
  elevationMinutesLeft,
  isElevationActive,
  unknownRoles,
  type ElevationRequest,
  type RoleChange,
} from './access-domain';

const change = (over: Partial<RoleChange> = {}): RoleChange => ({
  id: 'rc-1',
  subjectId: 'user-1',
  from: ['sales'],
  to: ['sales', 'finance'],
  requestedBy: 'alice',
  createdAt: '2026-01-01T00:00:00Z',
  ...over,
});

describe('unknownRoles', () => {
  it('flags a role the platform does not define', () => {
    expect(unknownRoles(['sales', 'superuser'])).toEqual(['superuser']);
  });
  it('accepts real roles', () => {
    expect(unknownRoles(['sales', 'finance'])).toEqual([]);
  });
});

describe('canApplyRoleChange — the two-person rule', () => {
  it('refuses a change approved by the same person who requested it', () => {
    expect(canApplyRoleChange(change(), 'alice')).toEqual({
      ok: false,
      reason: 'second approver must differ from requester',
    });
  });

  it('refuses a change with no approver', () => {
    expect(canApplyRoleChange(change(), '').ok).toBe(false);
  });

  it('allows a second, different approver', () => {
    expect(canApplyRoleChange(change(), 'bob')).toEqual({ ok: true });
  });

  it('refuses a change that grants an unknown role', () => {
    expect(canApplyRoleChange(change({ to: ['sales', 'root'] as any }), 'bob')).toEqual({
      ok: false,
      reason: 'unknown role: root',
    });
  });

  it('refuses re-approval by a third party once decided', () => {
    expect(canApplyRoleChange(change({ approvedBy: 'bob' }), 'carol')).toEqual({
      ok: false,
      reason: 'already approved by someone else',
    });
  });
});

describe('applyRoleChange', () => {
  it('returns the new role set, de-duplicated', () => {
    expect(applyRoleChange(change({ to: ['finance', 'finance', 'sales'] }), 'bob')).toEqual(['finance', 'sales']);
  });

  it('throws when the two-person rule is not met', () => {
    expect(() => applyRoleChange(change(), 'alice')).toThrow(/second approver/);
  });
});

const elevation = (over: Partial<ElevationRequest> = {}): ElevationRequest => ({
  id: 'el-1',
  subjectId: 'dev-1',
  role: 'devops',
  reason: 'prod incident',
  requestedBy: 'alice',
  minutes: 60,
  createdAt: '2026-01-01T00:00:00Z',
  expiresAt: '2026-01-01T01:00:00Z',
  ...over,
});

describe('canRequestElevation', () => {
  const now = new Date('2026-01-01T00:00:00Z');
  it('accepts a short, reasoned elevation', () => {
    expect(canRequestElevation(elevation(), now)).toEqual({ ok: true });
  });
  it('requires a reason', () => {
    expect(canRequestElevation(elevation({ reason: '  ' }), now).ok).toBe(false);
  });
  it('requires a positive duration', () => {
    expect(canRequestElevation(elevation({ minutes: 0 }), now).ok).toBe(false);
  });
  it('caps the duration', () => {
    expect(canRequestElevation(elevation({ minutes: 24 * 60 }), now)).toEqual({
      ok: false,
      reason: 'duration above maximum',
    });
  });
  it('refuses an unknown role', () => {
    expect(canRequestElevation(elevation({ role: 'root' as any }), now).ok).toBe(false);
  });
});

describe('elevation lifetime', () => {
  it('is active before it expires', () => {
    expect(isElevationActive(elevation(), new Date('2026-01-01T00:30:00Z'))).toBe(true);
  });
  it('is inactive after it expires', () => {
    expect(isElevationActive(elevation(), new Date('2026-01-01T02:00:00Z'))).toBe(false);
  });
  it('reports minutes left, floored at zero', () => {
    expect(elevationMinutesLeft(elevation(), new Date('2026-01-01T00:30:00Z'))).toBe(30);
    expect(elevationMinutesLeft(elevation(), new Date('2026-01-02T00:00:00Z'))).toBe(0);
  });
  it('always alerts the board', () => {
    expect(elevationAlert()).toEqual({ alert: true, audience: 'board' });
  });
});
