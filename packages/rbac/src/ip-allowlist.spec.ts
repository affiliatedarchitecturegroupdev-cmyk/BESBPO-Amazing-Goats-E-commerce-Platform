import { describe, expect, it } from 'vitest';
import {
  allowlistDecision,
  clientIpFromHeaders,
  ipInRange,
  isIpAllowed,
  parseAllowlist,
  parseIpRange,
} from './ip-allowlist';

describe('parseIpRange', () => {
  it('parses a single address', () => {
    expect(parseIpRange('196.25.1.10')).toEqual({
      kind: 'address',
      bytes: [196, 25, 1, 10],
    });
  });

  it('parses a CIDR block', () => {
    expect(parseIpRange('196.25.1.0/24')).toEqual({
      kind: 'cidr',
      bytes: [196, 25, 1, 0],
      prefix: 24,
    });
  });

  it('accepts the boundaries /0 and /32', () => {
    expect(parseIpRange('0.0.0.0/0')).toMatchObject({ prefix: 0 });
    expect(parseIpRange('196.25.1.10/32')).toMatchObject({ prefix: 32 });
  });

  it('rejects malformed input rather than guessing', () => {
    for (const bad of [
      '',
      '   ',
      '196.25.1',
      '196.25.1.10.5',
      '196.25.1.256',
      '196.25.1.-1',
      '196.25.1.0/33',
      '196.25.1.0/-1',
      '196.25.1.0/24/8',
      '196.25.01.10',
      '196.25.1.0/abc',
      'not-an-ip',
      '::1',
    ]) {
      expect(parseIpRange(bad), bad).toBeUndefined();
    }
  });
});

describe('ipInRange', () => {
  const range = (s: string) => parseIpRange(s)!;

  it('matches an exact address only', () => {
    expect(ipInRange('196.25.1.10', range('196.25.1.10'))).toBe(true);
    expect(ipInRange('196.25.1.11', range('196.25.1.10'))).toBe(false);
  });

  it('matches a /24 block', () => {
    expect(ipInRange('196.25.1.0', range('196.25.1.0/24'))).toBe(true);
    expect(ipInRange('196.25.1.255', range('196.25.1.0/24'))).toBe(true);
    expect(ipInRange('196.25.2.1', range('196.25.1.0/24'))).toBe(false);
  });

  it('respects a partial-byte mask', () => {
    // /26 is the first 64 addresses of the last byte: .0 - .63.
    expect(ipInRange('196.25.1.63', range('196.25.1.0/26'))).toBe(true);
    expect(ipInRange('196.25.1.64', range('196.25.1.0/26'))).toBe(false);
  });

  it('treats /0 as everything and /32 as one host', () => {
    expect(ipInRange('8.8.8.8', range('0.0.0.0/0'))).toBe(true);
    expect(ipInRange('8.8.8.8', range('8.8.8.8/32'))).toBe(true);
    expect(ipInRange('8.8.8.9', range('8.8.8.8/32'))).toBe(false);
  });

  it('does not match an unparseable address', () => {
    expect(ipInRange('garbage', range('0.0.0.0/0'))).toBe(false);
    expect(ipInRange('::1', range('0.0.0.0/0'))).toBe(false);
  });
});

describe('isIpAllowed', () => {
  const ranges = parseAllowlist('196.25.1.0/24, 41.13.7.20');

  it('allows a caller inside the list', () => {
    expect(isIpAllowed('196.25.1.44', ranges)).toBe(true);
    expect(isIpAllowed('41.13.7.20', ranges)).toBe(true);
  });

  it('denies a caller outside the list', () => {
    expect(isIpAllowed('8.8.8.8', ranges)).toBe(false);
  });

  it('denies when a list is configured but the IP is missing', () => {
    // A proxy that drops X-Forwarded-For must not become a way past the list.
    expect(isIpAllowed(undefined, ranges)).toBe(false);
    expect(isIpAllowed('', ranges)).toBe(false);
  });

  it('allows everything when no list is configured, for local development', () => {
    expect(isIpAllowed('8.8.8.8', [])).toBe(true);
    expect(isIpAllowed(undefined, [])).toBe(true);
  });
});

describe('parseAllowlist', () => {
  it('drops unparseable entries instead of throwing', () => {
    // One typo must not take the portal down for everyone.
    const ranges = parseAllowlist('196.25.1.0/24, nonsense, , 41.13.7.20');
    expect(ranges).toHaveLength(2);
  });

  it('returns an empty list for undefined or empty input', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist('')).toEqual([]);
  });
});

describe('clientIpFromHeaders', () => {
  it('takes the first hop of X-Forwarded-For', () => {
    const headers = new Headers({ 'x-forwarded-for': '196.25.1.10, 10.0.0.1, 10.0.0.2' });
    expect(clientIpFromHeaders(headers)).toBe('196.25.1.10');
  });

  it('falls back to X-Real-IP', () => {
    expect(clientIpFromHeaders(new Headers({ 'x-real-ip': '41.13.7.20' }))).toBe('41.13.7.20');
  });

  it('returns undefined when neither header is present', () => {
    expect(clientIpFromHeaders(new Headers())).toBeUndefined();
  });
});

describe('allowlistDecision', () => {
  it('reports the decision and the IP it used', () => {
    const headers = new Headers({ 'x-forwarded-for': '8.8.8.8' });
    expect(allowlistDecision(headers, '196.25.1.0/24')).toEqual({ allowed: false, ip: '8.8.8.8' });
  });

  it('denies a request with no IP when a list is configured', () => {
    expect(allowlistDecision(new Headers(), '196.25.1.0/24')).toEqual({
      allowed: false,
      ip: undefined,
    });
  });

  it('allows a request with no IP when no list is configured', () => {
    expect(allowlistDecision(new Headers(), undefined).allowed).toBe(true);
  });
});
