import { describe, it, expect } from 'vitest';
import { InMemoryAuditStore } from '@ag/nest-auth';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('reads the append-only log from its store', async () => {
    const store = new InMemoryAuditStore();
    await store.append({
      at: '2026-01-01T10:02:00Z',
      actorUserId: 'u1',
      action: 'POST',
      entity: '/identity/access/role-changes',
    });
    const svc = new AuditService(store);
    const rows = await svc.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].entity).toBe('/identity/access/role-changes');
  });

  it('filters by entity', async () => {
    const store = new InMemoryAuditStore();
    await store.append({ at: '2026-01-01T00:00:00Z', action: 'POST', entity: '/a' });
    await store.append({ at: '2026-01-01T00:00:00Z', action: 'POST', entity: '/b' });
    const rows = await new AuditService(store).list({ entity: '/a' });
    expect(rows.map((r) => r.entity)).toEqual(['/a']);
  });

  it('starts empty', async () => {
    expect(await new AuditService(new InMemoryAuditStore()).list()).toEqual([]);
  });
});
