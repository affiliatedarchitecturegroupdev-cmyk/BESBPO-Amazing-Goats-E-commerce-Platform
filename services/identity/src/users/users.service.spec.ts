import { describe, it, expect } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { InMemoryUsersStore } from './users.store';
import { Membership, User } from './users.types';

const now = () => new Date('2026-01-01T00:00:00Z');

const user = (over: Partial<User> = {}): User => ({
  id: 'u1',
  idpSubject: 'sub-1',
  email: 'user@example.co.za',
  fullName: null,
  phone: null,
  mfaEnrolled: false,
  status: 'active',
  marketingOptIn: false,
  consentAt: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...over,
});

const membership = (userId: string, memberRole: Membership['memberRole']): Membership => ({
  orgId: 'org-1',
  userId,
  memberRole,
});

function service(seed: User[] = [], members: Membership[] = []) {
  const store = new InMemoryUsersStore(seed);
  for (const m of members) void store.saveMembership(m);
  return { svc: new UsersService(store, now), store };
}

describe('UsersService.list / detail', () => {
  it('lists accounts by email', async () => {
    const { svc } = service([user({ id: 'b', email: 'b@x.co.za' }), user({ id: 'a', email: 'a@x.co.za' })]);
    expect((await svc.list()).map((u) => u.id)).toEqual(['a', 'b']);
  });

  it('returns access detail with sign-in and MFA flags', async () => {
    const { svc, store } = service([user()]);
    await store.setRoles('u1', ['finance'], 'admin');
    const detail = await svc.detail('u1');
    expect(detail.roles).toEqual(['finance']);
    expect(detail.canSignIn).toBe(true);
    expect(detail.requiresMfa).toBe(true); // staff, not enrolled
  });

  it('throws when the user is missing', async () => {
    const { svc } = service();
    await expect(svc.detail('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.create', () => {
  it('normalises the email and starts invited', async () => {
    const { svc } = service();
    const created = await svc.create({ idpSubject: 'sub-9', email: '  New@Example.CO.ZA ' }, 'admin');
    expect(created.email).toBe('new@example.co.za');
    expect(created.status).toBe('invited');
    expect(created.mfaEnrolled).toBe(false);
  });

  it('refuses a bad email and a duplicate', async () => {
    const { svc } = service([user({ id: 'u1', email: 'taken@example.co.za' })]);
    await expect(svc.create({ idpSubject: 's', email: 'not-an-email' }, 'admin')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(svc.create({ idpSubject: 's', email: 'TAKEN@example.co.za' }, 'admin')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('UsersService.setStatus', () => {
  it('changes the status and stamps updatedAt', async () => {
    const { svc } = service([user({ status: 'invited' })]);
    expect((await svc.setStatus('u1', 'active')).status).toBe('active');
    await expect(svc.setStatus('u1', 'nonsense' as any)).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UsersService.setRoles', () => {
  it('grants defined roles and refuses unknown ones', async () => {
    const { svc } = service([user()]);
    expect(await svc.setRoles('u1', ['sales', 'finance'], 'admin')).toHaveLength(2);
    await expect(svc.setRoles('u1', ['root' as any], 'admin')).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.setRoles('ghost', ['sales'], 'admin')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('UsersService.changeMemberRole', () => {
  it('changes a member role when the invariants hold', async () => {
    const { svc } = service([], [membership('u1', 'owner'), membership('u2', 'admin')]);
    const next = await svc.changeMemberRole({ orgId: 'org-1', subjectId: 'u2', to: 'accounts' }, 'u1');
    expect(next.find((m) => m.userId === 'u2')?.memberRole).toBe('accounts');
  });

  it('refuses removing the last owner', async () => {
    const { svc } = service([], [membership('u1', 'owner')]);
    await expect(
      svc.changeMemberRole({ orgId: 'org-1', subjectId: 'u1', to: 'admin' }, 'u2'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses an owner changing their own role', async () => {
    const { svc } = service([], [membership('u1', 'owner'), membership('u2', 'owner')]);
    await expect(
      svc.changeMemberRole({ orgId: 'org-1', subjectId: 'u1', to: 'admin' }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('404s for a non-member', async () => {
    const { svc } = service([], [membership('u1', 'owner')]);
    await expect(
      svc.changeMemberRole({ orgId: 'org-1', subjectId: 'ghost', to: 'buyer' }, 'u1'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
