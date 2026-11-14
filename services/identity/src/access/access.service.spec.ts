import { describe, it, expect } from 'vitest';
import { AccessService } from './access.service';
import { InMemoryAccessStore } from './access.store';

const clock = (iso: string) => () => new Date(iso);
const service = (iso = '2026-01-01T00:00:00Z') => new AccessService(new InMemoryAccessStore(), clock(iso));

describe('AccessService — role changes', () => {
  it('records a change request that waits for a second approver', async () => {
    const svc = service();
    const change = await svc.requestRoleChange({ subjectId: 'u1', from: ['sales'], to: ['sales', 'finance'] }, 'alice');
    expect(change.approvedBy).toBeUndefined();
    expect((await svc.listRoleChanges()).map((c) => c.id)).toEqual([change.id]);
  });

  it('refuses approval by the same person who requested the change', async () => {
    const svc = service();
    const change = await svc.requestRoleChange({ subjectId: 'u1', from: [], to: ['sales'] }, 'alice');
    await expect(svc.approveRoleChange(change.id, 'alice')).rejects.toThrow(/second approver/);
  });

  it('applies the change when a different approver signs off', async () => {
    const svc = service();
    const change = await svc.requestRoleChange({ subjectId: 'u1', from: [], to: ['sales', 'finance'] }, 'alice');
    const result = await svc.approveRoleChange(change.id, 'bob');
    expect(result.change.approvedBy).toBe('bob');
    expect(result.roles).toEqual(['sales', 'finance']);
  });

  it('404s for a change that does not exist', async () => {
    await expect(service().approveRoleChange('nope', 'bob')).rejects.toThrow(/not found/);
  });
});

describe('AccessService — break-glass elevation', () => {
  it('records a time-limited elevation with an expiry', async () => {
    const svc = service();
    const req = await svc.requestElevation({ subjectId: 'dev1', role: 'devops', reason: 'incident', minutes: 60 }, 'alice');
    expect(req.expiresAt).toBe('2026-01-01T01:00:00.000Z');
    expect((await svc.listElevations())[0].active).toBe(true);
  });

  it('refuses an elevation with no reason', async () => {
    const svc = service();
    await expect(
      svc.requestElevation({ subjectId: 'dev1', role: 'devops', reason: '', minutes: 60 }, 'alice'),
    ).rejects.toThrow(/reason required/);
  });

  it('flags every elevation as a board alert', async () => {
    const svc = service();
    await svc.requestElevation({ subjectId: 'dev1', role: 'devops', reason: 'incident', minutes: 30 }, 'alice');
    expect((await svc.listElevations())[0].alert).toBe(true);
  });

  it('reports an elevation as inactive once its window passes', async () => {
    const store = new InMemoryAccessStore();
    const before = new AccessService(store, clock('2026-01-01T00:00:00Z'));
    await before.requestElevation({ subjectId: 'dev1', role: 'devops', reason: 'incident', minutes: 30 }, 'alice');
    const after = new AccessService(store, clock('2026-01-01T02:00:00Z'));
    expect((await after.listElevations())[0].active).toBe(false);
  });
});
