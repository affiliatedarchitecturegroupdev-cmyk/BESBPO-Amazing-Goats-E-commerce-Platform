import { describe, it, expect } from 'vitest';
import { of, lastValueFrom } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { AuditInterceptor } from './index';
import { auditRecordFromRequest, isMutating, assertAppendOnly } from './audit-domain';
import { InMemoryAuditStore } from './audit-store';

const at = new Date('2026-01-01T10:02:00Z');

describe('isMutating', () => {
  it('is true for state-changing methods only', () => {
    expect(['POST', 'PUT', 'PATCH', 'DELETE'].every((m) => isMutating(m))).toBe(true);
    expect(isMutating('GET')).toBe(false);
    expect(isMutating('post')).toBe(true); // case-insensitive
    expect(isMutating(undefined)).toBe(false);
  });
});

describe('auditRecordFromRequest', () => {
  const req = {
    method: 'PATCH',
    url: '/identity/roles/42',
    route: { path: '/identity/roles/:id' },
    params: { id: '42' },
    ip: '10.0.0.9',
    headers: { 'x-request-id': 'req-7' },
  };

  it('records the actor, action, entity and request id', () => {
    expect(auditRecordFromRequest(req, { id: 'u1', roles: ['chief_admin'] }, at)).toEqual({
      at: at.toISOString(),
      actorUserId: 'u1',
      actorRoles: ['chief_admin'],
      action: 'PATCH',
      entity: '/identity/roles/:id',
      entityId: '42',
      ip: '10.0.0.9',
      requestId: 'req-7',
    });
  });

  it('records an anonymous actor as undefined', () => {
    const rec = auditRecordFromRequest(req, undefined, at);
    expect(rec.actorUserId).toBeUndefined();
  });
});

describe('assertAppendOnly', () => {
  it('refuses updates and deletes', () => {
    expect(() => assertAppendOnly('update')).toThrow(/append-only/);
    expect(() => assertAppendOnly('delete')).toThrow(/append-only/);
  });
});

describe('InMemoryAuditStore', () => {
  it('appends and lists newest first', async () => {
    const store = new InMemoryAuditStore();
    await store.append(auditRecordFromRequest({ method: 'POST', url: '/a' }, undefined, new Date('2026-01-01T00:00:00Z')));
    await store.append(auditRecordFromRequest({ method: 'POST', url: '/b' }, undefined, new Date('2026-01-01T00:01:00Z')));
    const rows = await store.list();
    expect(rows.map((r) => r.entity)).toEqual(['/b', '/a']);
  });

  it('filters by entity and actor', async () => {
    const store = new InMemoryAuditStore();
    await store.append(auditRecordFromRequest({ method: 'POST', url: '/a' }, { id: 'u1', roles: [] }, at));
    await store.append(auditRecordFromRequest({ method: 'POST', url: '/b' }, { id: 'u2', roles: [] }, at));
    expect((await store.list({ entity: '/a' })).map((r) => r.entity)).toEqual(['/a']);
    expect((await store.list({ actorUserId: 'u2' })).map((r) => r.entity)).toEqual(['/b']);
  });

  it('refuses to update or delete rows', async () => {
    const store = new InMemoryAuditStore();
    await expect(store.update()).rejects.toThrow(/append-only/);
    await expect(store.remove()).rejects.toThrow(/append-only/);
  });
});

describe('AuditInterceptor', () => {
  const ctxFor = (req: any): ExecutionContext =>
    ({ switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext);
  const handler = (value: unknown): CallHandler => ({ handle: () => of(value) });

  it('writes one row for a mutating request and passes the response through', async () => {
    const store = new InMemoryAuditStore();
    const interceptor = new AuditInterceptor(store);
    const req = { method: 'POST', url: '/identity/roles', route: { path: '/identity/roles' }, headers: {} };
    const value = await lastValueFrom(interceptor.intercept(ctxFor(req), handler({ ok: true })));
    expect(value).toEqual({ ok: true });
    const rows = await store.list();
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('POST');
    expect(rows[0].entity).toBe('/identity/roles');
  });

  it('writes nothing for a GET', async () => {
    const store = new InMemoryAuditStore();
    const interceptor = new AuditInterceptor(store);
    const req = { method: 'GET', url: '/identity/roles', headers: {} };
    await lastValueFrom(interceptor.intercept(ctxFor(req), handler([])));
    expect(await store.list()).toEqual([]);
  });

  it('attributes the row to the bearer-token caller', async () => {
    const store = new InMemoryAuditStore();
    const { createHmac } = await import('node:crypto');
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const nowSec = Math.floor(Date.now() / 1000);
    const input = `${b64({ alg: 'HS256' })}.${b64({ sub: 'u9', roles: ['finance'], exp: nowSec + 60 })}`;
    const token = `${input}.${createHmac('sha256', 's').update(input).digest('base64url')}`;
    const interceptor = new AuditInterceptor(store, { secret: 's' });
    const req = { method: 'DELETE', url: '/x', headers: { authorization: `Bearer ${token}` } };
    await lastValueFrom(interceptor.intercept(ctxFor(req), handler(null)));
    const rows = await store.list();
    expect(rows[0].actorUserId).toBe('u9');
    expect(rows[0].actorRoles).toEqual(['finance']);
  });
});
