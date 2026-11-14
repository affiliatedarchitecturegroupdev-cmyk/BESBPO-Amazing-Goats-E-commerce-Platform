import { describe, it, expect } from 'vitest';
import { createHmac, generateKeyPairSync, sign as signRsa } from 'node:crypto';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { verifyJwt, JwtError } from './jwt';
import {
  rolesFromClaims,
  userFromClaims,
  userFromRequest,
  isDevShimAllowed,
  authOptionsFromEnv,
  PermissionsGuard,
  PERMS_KEY,
} from './index';

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => 1_700_000_000_000; // fixed clock (seconds: 1_700_000_000)
const nowSec = Math.floor(now() / 1000);

function signHs256(payload: Record<string, unknown>, secret = 'test-secret', header = { alg: 'HS256', typ: 'JWT' }) {
  const input = `${b64(header)}.${b64(payload)}`;
  const sig = createHmac('sha256', secret).update(input).digest('base64url');
  return `${input}.${sig}`;
}

const baseClaims = { sub: 'user-1', iss: 'http://idp/realms/ag', aud: 'ag-platform', exp: nowSec + 3600 };

describe('verifyJwt (HS256)', () => {
  it('verifies a well-formed token and returns its claims', () => {
    const token = signHs256({ ...baseClaims, roles: ['executive'], org_id: 'org-9' });
    const claims = verifyJwt(token, { secret: 'test-secret', issuer: baseClaims.iss, audience: baseClaims.aud, now });
    expect(claims.sub).toBe('user-1');
    expect(claims.org_id).toBe('org-9');
  });
  it('rejects a token signed with the wrong secret', () => {
    const token = signHs256(baseClaims, 'other-secret');
    expect(() => verifyJwt(token, { secret: 'test-secret', now })).toThrow(JwtError);
  });
  it('rejects an expired token', () => {
    const token = signHs256({ ...baseClaims, exp: nowSec - 1 });
    expect(() => verifyJwt(token, { secret: 'test-secret', now })).toThrow(/expired/);
  });
  it('rejects a token that is not yet valid', () => {
    const token = signHs256({ ...baseClaims, nbf: nowSec + 60 });
    expect(() => verifyJwt(token, { secret: 'test-secret', now })).toThrow(/not yet valid/);
  });
  it('rejects the wrong issuer or audience', () => {
    const token = signHs256(baseClaims);
    expect(() => verifyJwt(token, { secret: 'test-secret', issuer: 'http://evil', now })).toThrow(/issuer/);
    expect(() => verifyJwt(token, { secret: 'test-secret', audience: 'other', now })).toThrow(/audience/);
  });
  it('rejects a missing subject and malformed tokens', () => {
    expect(() => verifyJwt(signHs256({ ...baseClaims, sub: undefined }), { secret: 'test-secret', now })).toThrow();
    expect(() => verifyJwt('not-a-token', { secret: 'test-secret', now })).toThrow(/malformed/);
    expect(() => verifyJwt('a.b', { secret: 'test-secret', now })).toThrow(/malformed/);
  });
  it('rejects alg=none and algorithms that are not configured', () => {
    const none = `${b64({ alg: 'none' })}.${b64(baseClaims)}.`;
    expect(() => verifyJwt(none, { secret: 'test-secret', now })).toThrow(/unsupported algorithm/);
    const token = signHs256(baseClaims);
    expect(() => verifyJwt(token, { publicKey: 'irrelevant', algorithms: ['RS256'], now })).toThrow(/unsupported algorithm/);
  });
});

describe('verifyJwt (RS256)', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const signRs = (payload: Record<string, unknown>) => {
    const input = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}`;
    return `${input}.${signRsa('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url')}`;
  };
  it('verifies a token signed by the matching private key', () => {
    const claims = verifyJwt(signRs(baseClaims), { publicKey, now });
    expect(claims.sub).toBe('user-1');
  });
  it('rejects a tampered payload', () => {
    const token = signRs(baseClaims);
    const [h, , s] = token.split('.');
    const tampered = `${h}.${b64({ ...baseClaims, sub: 'attacker' })}.${s}`;
    expect(() => verifyJwt(tampered, { publicKey, now })).toThrow(/signature/);
  });
});

describe('claim and request mapping', () => {
  it('reads flat and Keycloak nested roles, ignoring non-strings', () => {
    expect(rolesFromClaims({ sub: 's', roles: ['sales', 'driver'] })).toEqual(['sales', 'driver']);
    expect(rolesFromClaims({ sub: 's', realm_access: { roles: ['executive'] } })).toEqual(['executive']);
    expect(rolesFromClaims({ sub: 's', roles: [1, 'driver'] as unknown[] })).toEqual(['driver']);
    expect(rolesFromClaims({ sub: 's' })).toEqual([]);
  });
  it('maps claims to an AuthUser', () => {
    expect(userFromClaims({ sub: 'u', roles: ['finance'], org_id: 'o' })).toEqual({ id: 'u', roles: ['finance'], orgId: 'o' });
  });
  it('authenticates a valid bearer token and treats an invalid one as anonymous', () => {
    const req = { headers: { authorization: `Bearer ${signHs256({ ...baseClaims, roles: ['executive'] })}` } };
    expect(userFromRequest(req, { secret: 'test-secret', now })?.roles).toEqual(['executive']);
    const bad = { headers: { authorization: 'Bearer nonsense' } };
    expect(userFromRequest(bad, { secret: 'test-secret', now })).toBeUndefined();
  });
  it('honours the dev header shim only when opted in and outside production', () => {
    const req = { headers: { 'x-dev-user': 'dev-1', 'x-dev-roles': 'sales,driver' } };
    const prev = process.env.NODE_ENV;

    process.env.NODE_ENV = 'development';
    expect(userFromRequest(req, {})).toBeUndefined(); // not opted in
    expect(userFromRequest(req, { allowDevHeaders: true })?.roles).toEqual(['sales', 'driver']);
    expect(isDevShimAllowed({ allowDevHeaders: true })).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(isDevShimAllowed({ allowDevHeaders: true })).toBe(false);
    expect(userFromRequest(req, { allowDevHeaders: true })).toBeUndefined(); // never in production

    process.env.NODE_ENV = prev;
  });

  it('honours the AG_ALLOW_DEV_HEADERS opt-in outside production only', () => {
    const req = { headers: { 'x-dev-user': 'dev-1', 'x-dev-roles': 'sales' } };
    const prev = process.env.NODE_ENV;
    const prevFlag = process.env.AG_ALLOW_DEV_HEADERS;

    process.env.NODE_ENV = 'development';
    process.env.AG_ALLOW_DEV_HEADERS = 'true';
    expect(isDevShimAllowed({})).toBe(true);
    expect(userFromRequest(req, {})?.roles).toEqual(['sales']);

    process.env.NODE_ENV = 'production';
    expect(isDevShimAllowed({})).toBe(false);
    expect(userFromRequest(req, {})).toBeUndefined(); // never in production

    process.env.NODE_ENV = prev;
    if (prevFlag === undefined) delete process.env.AG_ALLOW_DEV_HEADERS;
    else process.env.AG_ALLOW_DEV_HEADERS = prevFlag;
  });
});

describe('authOptionsFromEnv', () => {
  it('reads the JWT settings and the dev-shim flag from the environment', () => {
    const opts = authOptionsFromEnv({
      JWT_SECRET: 's', JWT_PUBLIC_KEY: 'p', JWT_ISSUER: 'i', JWT_AUDIENCE: 'a', AG_ALLOW_DEV_HEADERS: 'true',
    } as NodeJS.ProcessEnv);
    expect(opts).toMatchObject({ secret: 's', publicKey: 'p', issuer: 'i', audience: 'a', allowDevHeaders: true });
  });

  it('defaults the dev-shim flag to off', () => {
    expect(authOptionsFromEnv({} as NodeJS.ProcessEnv).allowDevHeaders).toBe(false);
  });
});

describe('PermissionsGuard', () => {
  const reflector = new Reflector();
  const ctxFor = (_required: string[] | undefined, req: any): any => ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => req }),
  });
  // The guard reads metadata via the reflector, so stub it per test.
  const guardFor = (required: string[] | undefined, opts = {}) => {
    const g = new PermissionsGuard(reflector, opts as any);
    (reflector as any).getAllAndOverride = () => required;
    return g;
  };

  it('allows a route with no declared permissions', () => {
    expect(guardFor(undefined, {}).canActivate(ctxFor(undefined, { headers: {} }))).toBe(true);
    expect(guardFor([], {}).canActivate(ctxFor([], { headers: {} }))).toBe(true);
  });

  it('throws 401 when a protected route is called without a token', () => {
    const guard = guardFor(['roles:manage'], { secret: 'test-secret', now });
    expect(() => guard.canActivate(ctxFor(['roles:manage'], { headers: {} }))).toThrow(UnauthorizedException);
  });

  it('throws 401 for an invalid token', () => {
    const guard = guardFor(['roles:manage'], { secret: 'test-secret', now });
    const req = { headers: { authorization: 'Bearer nonsense' } };
    expect(() => guard.canActivate(ctxFor(['roles:manage'], req))).toThrow(UnauthorizedException);
  });

  it('throws 403 when the caller lacks the permission', () => {
    const guard = guardFor(['roles:manage'], { secret: 'test-secret', now });
    const token = signHs256({ ...baseClaims, roles: ['driver'] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    expect(() => guard.canActivate(ctxFor(['roles:manage'], req))).toThrow(ForbiddenException);
  });

  it('allows a caller holding the permission', () => {
    const guard = guardFor(['roles:manage'], { secret: 'test-secret', now });
    const token = signHs256({ ...baseClaims, roles: ['chief_admin'] });
    const req = { headers: { authorization: `Bearer ${token}` } };
    expect(guard.canActivate(ctxFor(['roles:manage'], req))).toBe(true);
  });

  it('constructs without any injected options (the app-module wiring case)', () => {
    expect(() => new PermissionsGuard(reflector)).not.toThrow();
  });
});
