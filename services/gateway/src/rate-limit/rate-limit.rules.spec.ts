import { describe, it, expect } from 'vitest';
import { clientIp } from './rate-limit.guard';
import {
  DEFAULT_RULE,
  newBucket,
  rateLimitDecision,
  rateLimitKey,
  refill,
  retryAfterSeconds,
  routeKey,
  ruleFor,
} from './rate-limit.rules';

const rule = { refillPerSec: 2, burst: 3 };
const T = 1_700_000_000_000;

describe('refill', () => {
  it('adds tokens for elapsed time, capped at the burst', () => {
    expect(refill({ tokens: 0, updatedAt: T }, T + 1000, rule).tokens).toBe(2);
    expect(refill({ tokens: 0, updatedAt: T }, T + 10_000, rule).tokens).toBe(3);
  });

  it('is fractional, so a sub-second wait still credits a partial token', () => {
    expect(refill({ tokens: 0, updatedAt: T }, T + 250, rule).tokens).toBeCloseTo(0.5);
  });

  it('never goes backwards when the clock is skewed', () => {
    expect(refill({ tokens: 1, updatedAt: T }, T - 5000, rule).tokens).toBe(1);
  });
});

describe('rateLimitDecision', () => {
  it('gives a fresh bucket the full burst', () => {
    const first = rateLimitDecision(undefined, T, rule);
    expect(first.allowed).toBe(true);
    expect(first.bucket.tokens).toBe(2);
    expect(newBucket(rule.burst, T)).toEqual({ tokens: 3, updatedAt: T });
  });

  it('spends a token per call and refuses when the bucket is empty', () => {
    let bucket = undefined as undefined | { tokens: number; updatedAt: number };
    for (let i = 0; i < 3; i++) {
      const d = rateLimitDecision(bucket, T, rule);
      expect(d.allowed).toBe(true);
      bucket = d.bucket;
    }
    const refused = rateLimitDecision(bucket, T, rule);
    expect(refused.allowed).toBe(false);
    expect(refused.retryAfterSec).toBe(1); // 1 token needed at 2/sec → ceil(0.5) = 1
  });

  it('allows again once enough time has passed', () => {
    const empty = { tokens: 0, updatedAt: T };
    expect(rateLimitDecision(empty, T + 250, rule).allowed).toBe(false); // 0.5 token
    expect(rateLimitDecision(empty, T + 500, rule).allowed).toBe(true); // 1 token
  });
});

describe('retryAfterSeconds', () => {
  it('is at least one second and rounds up', () => {
    expect(retryAfterSeconds(0.5, rule)).toBe(1);
    expect(retryAfterSeconds(3, { refillPerSec: 2, burst: 3 })).toBe(2);
    expect(retryAfterSeconds(1, { refillPerSec: 0, burst: 1 })).toBe(60);
  });
});

describe('keys', () => {
  it('keys a user by id and an anonymous caller by IP', () => {
    expect(rateLimitKey('u1', '1.2.3.4')).toBe('u:u1');
    expect(rateLimitKey(undefined, '1.2.3.4')).toBe('ip:1.2.3.4');
    expect(rateLimitKey(undefined, undefined)).toBe('ip:unknown');
  });

  it('builds a METHOD path key with the query stripped', () => {
    expect(routeKey('get', '/gateway/auth/me?x=1')).toBe('GET /gateway/auth/me');
    expect(routeKey('POST', '/a/b/')).toBe('POST /a/b');
    expect(routeKey(undefined, undefined)).toBe('GET /');
  });
});

describe('ruleFor', () => {
  it('falls back to the default rule', () => {
    expect(ruleFor({}, 'GET /nope')).toEqual(DEFAULT_RULE);
    expect(ruleFor({ 'GET /x': rule }, 'GET /x')).toEqual(rule);
  });

  it('prefers an exact key over a prefix', () => {
    const specific = { refillPerSec: 9, burst: 9 };
    const rules = { 'GET /a': rule, 'GET /a/b': specific };
    expect(ruleFor(rules, 'GET /a/b')).toEqual(specific);
  });

  it('applies a collection rule to a route with a path parameter', () => {
    // A `:id` route is addressed by its concrete path at request time, so the
    // rule written for the collection must still govern it.
    const rules = { 'GET /gateway/assistant/conversations': rule };
    expect(ruleFor(rules, 'GET /gateway/assistant/conversations/abc123')).toEqual(rule);
  });

  it('does not borrow a rule from a different method', () => {
    const rules = { 'GET /x': rule };
    expect(ruleFor(rules, 'POST /x')).toEqual(DEFAULT_RULE);
  });

  it('does not match a path that merely shares a prefix segment', () => {
    const rules = { 'GET /gateway/assistant': rule };
    expect(ruleFor(rules, 'GET /gateway/assistantx/y')).toEqual(DEFAULT_RULE);
  });
});

describe('clientIp', () => {
  it('takes the first X-Forwarded-For hop, then the socket address', () => {
    expect(clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } })).toBe('9.9.9.9');
    expect(clientIp({ headers: {}, ip: '7.7.7.7' })).toBe('7.7.7.7');
    expect(clientIp({ headers: {}, socket: { remoteAddress: '6.6.6.6' } })).toBe('6.6.6.6');
  });
});
