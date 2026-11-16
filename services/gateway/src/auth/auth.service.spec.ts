import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { bearerToken, claimsFromRequest, meView, sessionView } from './session';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const nowSec = 1_700_000_000;
const now = () => nowSec * 1000;

function signHs256(payload: Record<string, unknown>, secret = 'test-secret') {
  const input = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

describe('bearerToken', () => {
  it('reads a bearer token and ignores other schemes', () => {
    expect(bearerToken({ headers: { authorization: 'Bearer abc.def.ghi' } })).toBe('abc.def.ghi');
    expect(bearerToken({ headers: { authorization: 'Basic abc' } })).toBeUndefined();
    expect(bearerToken({ headers: {} })).toBeUndefined();
  });
});

describe('claimsFromRequest', () => {
  it('verifies a good token and drops a bad one', () => {
    const good = { headers: { authorization: `Bearer ${signHs256({ sub: 'u', exp: nowSec + 60 })}` } };
    expect(claimsFromRequest(good, { secret: 'test-secret', now })?.sub).toBe('u');
    const bad = { headers: { authorization: 'Bearer nonsense' } };
    expect(claimsFromRequest(bad, { secret: 'test-secret', now })).toBeUndefined();
  });
});

describe('sessionView', () => {
  it('reports staff, expiry and seconds remaining', () => {
    const view = sessionView({ id: 'u', roles: ['executive'] }, { sub: 'u', iat: nowSec, exp: nowSec + 900 }, new Date(now()));
    expect(view.staff).toBe(true);
    expect(view.expiresAt).toBe(new Date((nowSec + 900) * 1000).toISOString());
    expect(view.secondsRemaining).toBe(900);
  });

  it('treats an external role as non-staff and floors the remaining time', () => {
    const view = sessionView({ id: 'u', roles: ['customer_household'] }, { sub: 'u', exp: nowSec - 5 }, new Date(now()));
    expect(view.staff).toBe(false);
    expect(view.secondsRemaining).toBe(0);
  });

  it('handles a session with no token timing', () => {
    const view = sessionView({ id: 'dev', roles: [] }, undefined, new Date(now()));
    expect(view.issuedAt).toBeNull();
    expect(view.expiresAt).toBeNull();
    expect(view.secondsRemaining).toBeNull();
  });
});

describe('meView', () => {
  it('adds the staff flag without dropping the caller fields', () => {
    expect(meView({ id: 'u', roles: ['driver'], orgId: 'o1' })).toEqual({
      id: 'u',
      roles: ['driver'],
      orgId: 'o1',
      staff: true,
    });
  });
});

describe('AuthService', () => {
  const service = () => new AuthService({ secret: 'test-secret', now }, () => new Date(now()));

  it('returns the resolved caller for /me', () => {
    const req = { headers: { authorization: `Bearer ${signHs256({ sub: 'u1', roles: ['sales'], exp: nowSec + 60 })}` } };
    expect(service().me(req)).toMatchObject({ id: 'u1', roles: ['sales'], staff: true });
  });

  it('returns session timing read from the token', () => {
    const token = signHs256({ sub: 'u1', roles: ['executive'], iat: nowSec, exp: nowSec + 600 });
    const view = service().session({ headers: { authorization: `Bearer ${token}` } });
    expect(view.expiresAt).toBe(new Date((nowSec + 600) * 1000).toISOString());
    expect(view.secondsRemaining).toBe(600);
  });

  it('refuses an anonymous caller', () => {
    expect(() => service().me({ headers: {} })).toThrow(UnauthorizedException);
    expect(() => service().session({ headers: {} })).toThrow(UnauthorizedException);
  });
});
