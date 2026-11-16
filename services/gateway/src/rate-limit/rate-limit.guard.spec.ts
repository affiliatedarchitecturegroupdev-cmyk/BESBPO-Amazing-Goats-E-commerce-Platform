import { describe, it, expect } from 'vitest';
import { HttpException } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { RateLimitGuard } from './rate-limit.guard';
import { RateLimitService } from './rate-limit.service';
import { InMemoryRateLimitStore } from './rate-limit.store';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const secret = 'test-secret';
const nowSec = 1_700_000_000;
const nowMs = () => nowSec * 1000; // JWT clock expects epoch milliseconds
const nowDate = () => new Date(nowSec * 1000); // limiter clock expects a Date
const rule = { refillPerSec: 1, burst: 1 };
const rules = { 'GET /gateway/auth/me': rule };

function token(sub: string) {
  const input = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, exp: nowSec + 3600 })}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

function ctx(req: any) {
  const headers: Record<string, string> = {};
  const res = { setHeader: (k: string, v: string) => void (headers[k] = v) };
  return {
    headers,
    execution: {
      switchToHttp: () => ({ getRequest: () => req, getResponse: () => res }),
    } as any,
  };
}

function guard() {
  return new RateLimitGuard(new RateLimitService(new InMemoryRateLimitStore(), rules, nowDate), { secret, now: nowMs });
}

describe('RateLimitGuard', () => {
  it('allows a call under the limit', async () => {
    const { execution } = ctx({ method: 'GET', path: '/gateway/auth/me', headers: {} });
    await expect(guard().canActivate(execution)).resolves.toBe(true);
  });

  it('answers 429 with Retry-After once the bucket is empty', async () => {
    const g = guard();
    const { execution, headers } = ctx({ method: 'GET', path: '/gateway/auth/me', headers: { authorization: `Bearer ${token('u1')}` } });
    await g.canActivate(execution); // spends the only token
    await expect(g.canActivate(execution)).rejects.toBeInstanceOf(HttpException);
    expect(headers['Retry-After']).toBe('1');
  });

  it('keys by user, so two users on one IP do not share a bucket', async () => {
    const g = guard();
    const one = ctx({ method: 'GET', path: '/gateway/auth/me', headers: { authorization: `Bearer ${token('u1')}`, 'x-forwarded-for': '1.1.1.1' } });
    const two = ctx({ method: 'GET', path: '/gateway/auth/me', headers: { authorization: `Bearer ${token('u2')}`, 'x-forwarded-for': '1.1.1.1' } });
    await g.canActivate(one.execution);
    await expect(g.canActivate(two.execution)).resolves.toBe(true);
  });

  it('does nothing when no limiter is wired', async () => {
    const { execution } = ctx({ method: 'GET', path: '/gateway/auth/me', headers: {} });
    await expect(new RateLimitGuard().canActivate(execution)).resolves.toBe(true);
  });
});
