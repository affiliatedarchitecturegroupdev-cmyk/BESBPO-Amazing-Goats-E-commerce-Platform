import { describe, it, expect } from 'vitest';
import { Role } from '@ag/rbac';
import {
  applyMemberRoleChange,
  canSignIn,
  isMemberRole,
  isPlatformRole,
  normaliseEmail,
  ownerCount,
  requiresMfa,
} from './users.rules';
import { MemberRoleChange, OrgMembership, User, UserAdminError } from './users.types';

const user = (over: Partial<User> = {}): User => ({
  id: 'u1',
  idpSubject: 'sub-1',
  email: 'user@example.co.za',
  fullName: 'Test User',
  phone: null,
  mfaEnrolled: false,
  status: 'active',
  marketingOptIn: false,
  consentAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const org = (roles: Record<string, 'owner' | 'admin' | 'buyer' | 'accounts'>): OrgMembership => ({
  orgId: 'org-1',
  members: Object.entries(roles).map(([userId, memberRole]) => ({ orgId: 'org-1', userId, memberRole })),
});

const change = (over: Partial<MemberRoleChange> = {}): MemberRoleChange => ({
  orgId: 'org-1',
  subjectId: 'u2',
  from: 'admin',
  to: 'buyer',
  actorId: 'u1',
  ...over,
});

describe('isMemberRole / isPlatformRole', () => {
  it('accepts defined values and rejects unknown ones', () => {
    expect(isMemberRole('owner')).toBe(true);
    expect(isMemberRole('superuser')).toBe(false);
    expect(isPlatformRole('sales')).toBe(true);
    expect(isPlatformRole('root')).toBe(false);
  });
});

describe('ownerCount', () => {
  it('counts the owners in an organisation', () => {
    expect(ownerCount(org({ a: 'owner', b: 'owner', c: 'buyer' }))).toBe(2);
    expect(ownerCount(org({ a: 'admin' }))).toBe(0);
  });
});

describe('assertRoleChange — the org invariants', () => {
  it('refuses an unknown target role', () => {
    expect(() => applyMemberRoleChange(org({ u1: 'owner', u2: 'admin' }), change({ to: 'root' as any }))).toThrow(
      UserAdminError,
    );
  });

  it('refuses a change to someone who is not a member', () => {
    expect(() => applyMemberRoleChange(org({ u1: 'owner' }), change({ subjectId: 'ghost' }))).toThrow(
      /not a member/,
    );
  });

  it('refuses to remove the last owner', () => {
    expect(() =>
      applyMemberRoleChange(org({ u1: 'owner', u2: 'admin' }), change({ subjectId: 'u1', from: 'owner', to: 'admin', actorId: 'u2' })),
    ).toThrow(/last owner/);
  });

  it('allows demoting an owner when another owner remains', () => {
    const next = applyMemberRoleChange(
      org({ u1: 'owner', u2: 'owner' }),
      change({ subjectId: 'u1', from: 'owner', to: 'admin', actorId: 'u2' }),
    );
    expect(next.members.find((m) => m.userId === 'u1')?.memberRole).toBe('admin');
    expect(ownerCount(next)).toBe(1);
  });

  it('refuses an owner changing their own role', () => {
    expect(() =>
      applyMemberRoleChange(org({ u1: 'owner', u2: 'owner' }), change({ subjectId: 'u1', from: 'owner', to: 'admin', actorId: 'u1' })),
    ).toThrow(/own role/);
  });

  it('applies an ordinary change, leaving other members untouched', () => {
    const next = applyMemberRoleChange(
      org({ u1: 'owner', u2: 'admin', u3: 'buyer' }),
      change({ subjectId: 'u2', from: 'admin', to: 'accounts' }),
    );
    expect(next.members.map((m) => `${m.userId}:${m.memberRole}`)).toEqual(['u1:owner', 'u2:accounts', 'u3:buyer']);
  });
});

describe('canSignIn', () => {
  it('needs an active account with a subject', () => {
    expect(canSignIn(user())).toBe(true);
    expect(canSignIn(user({ status: 'suspended' }))).toBe(false);
    expect(canSignIn(user({ idpSubject: '' }))).toBe(false);
  });
});

describe('requiresMfa', () => {
  it('is required for staff who have not enrolled, not for customers', () => {
    const staff: Role[] = ['finance'];
    const customer: Role[] = ['customer_household'];
    expect(requiresMfa(user({ mfaEnrolled: false }), staff)).toBe(true);
    expect(requiresMfa(user({ mfaEnrolled: true }), staff)).toBe(false);
    expect(requiresMfa(user({ mfaEnrolled: false }), customer)).toBe(false);
  });
});

describe('normaliseEmail', () => {
  it('trims and lower-cases', () => {
    expect(normaliseEmail('  User@Example.CO.ZA ')).toBe('user@example.co.za');
  });
});
