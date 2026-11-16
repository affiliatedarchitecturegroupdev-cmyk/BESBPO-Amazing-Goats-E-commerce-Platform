import { describe, it, expect } from 'vitest';
import { RateLimitService } from './rate-limit.service';
import { InMemoryRateLimitStore } from './rate-limit.store';
import { ROUTE_RULES } from './rate-limit.rules';

const nowMs = 1_700_000_000_000;
const frozen = () => new Date(nowMs);
const rule = { refillPerSec: 1, burst: 2 };
const rules = { 'GET /x': rule };

function service(clockMs = nowMs) {
  return new RateLimitService(new InMemoryRateLimitStore(), rules, () => new Date(clockMs));
}

describe('RateLimitService.check', () => {
  it('allows up to the burst then refuses with Retry-After', async () => {
    const svc = service();
    expect((await svc.check('GET', '/x', 'u1', '1.1.1.1')).allowed).toBe(true);
    expect((await svc.check('GET', '/x', 'u1', '1.1.1.1')).allowed).toBe(true);
    const third = await svc.check('GET', '/x', 'u1', '1.1.1.1');
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSec).toBe(1); // refillPerSec 1 → one second per token
  });

  it('keys a signed-in caller by user and an anonymous one by IP', async () => {
    const svc = service();
    await svc.check('GET', '/x', 'u1', '1.1.1.1');
    await svc.check('GET', '/x', 'u1', '1.1.1.1');
    // A different user from the same IP has its own bucket.
    expect((await svc.check('GET', '/x', 'u2', '1.1.1.1')).allowed).toBe(true);
    // An anonymous caller shares the IP bucket with no other user id.
    const anon = new RateLimitService(new InMemoryRateLimitStore(), rules, frozen);
    expect((await anon.check('GET', '/x', undefined, '9.9.9.9')).allowed).toBe(true);
    expect((await anon.check('GET', '/x', undefined, '9.9.9.9')).allowed).toBe(true);
    expect((await anon.check('GET', '/x', undefined, '9.9.9.9')).allowed).toBe(false);
  });

  it('refills over time', async () => {
    const store = new InMemoryRateLimitStore();
    const first = new RateLimitService(store, rules, () => new Date(nowMs));
    await first.check('GET', '/x', 'u1', 'ip');
    await first.check('GET', '/x', 'u1', 'ip');
    expect((await first.check('GET', '/x', 'u1', 'ip')).allowed).toBe(false);
    // Two seconds later, two tokens are back.
    const later = new RateLimitService(store, rules, () => new Date(nowMs + 2000));
    expect((await later.check('GET', '/x', 'u1', 'ip')).allowed).toBe(true);
  });

  it('uses the default rule for an unlisted route', async () => {
    const svc = service();
    expect(svc.ruleFor('GET', '/unknown')).toEqual({ refillPerSec: 5, burst: 20 });
  });

  it('applies the configured per-route limit', () => {
    const svc = new RateLimitService(new InMemoryRateLimitStore(), ROUTE_RULES, frozen);
    expect(svc.ruleFor('GET', '/gateway/auth/me')).toEqual({ refillPerSec: 2, burst: 10 });
    expect(svc.limits().routes['GET /gateway/bff/catalogue']).toEqual({ refillPerSec: 10, burst: 40 });
  });
});
