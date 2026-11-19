import { describe, expect, it } from 'vitest';
import {
  guardDecision,
  guardDecisionGuardedOnly,
  isPublicPath,
  homePortalFor,
  parseCookieHeader,
  PORTAL_ROLES,
  readSessionCookie,
  rolesFromClaim,
  safeLocalPath,
  sessionCookieFromHeader,
  signInPath,
  wrongPortal,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
} from './session';

/** Build an unsigned token with the given claims. Middleware reads claims only. */
function token(claims: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${body}.not-a-real-signature`;
}

const NOW = 1_700_000_000_000;
const future = Math.floor(NOW / 1000) + 600;
const past = Math.floor(NOW / 1000) - 600;

describe('readSessionCookie', () => {
  it('reports none when there is no cookie', () => {
    expect(readSessionCookie(undefined, NOW)).toEqual({ state: 'none' });
    expect(readSessionCookie('', NOW)).toEqual({ state: 'none' });
  });

  it('reads the claims of a live token', () => {
    const read = readSessionCookie(
      token({ sub: 'usr_1', roles: ['ops_manager'], org_id: 'org-1', email: 'a@b.c', exp: future, iat: 1 }),
      NOW,
    );
    expect(read.state).toBe('present');
    if (read.state !== 'present') throw new Error('unreachable');
    expect(read.claims.sub).toBe('usr_1');
    expect(read.claims.roles).toEqual(['ops_manager']);
    expect(read.claims.orgId).toBe('org-1');
    expect(read.claims.email).toBe('a@b.c');
  });

  it('reports expired for a token whose exp has passed', () => {
    expect(readSessionCookie(token({ sub: 'usr_1', exp: past }), NOW)).toEqual({ state: 'expired' });
  });

  it('treats a token with no exp as present rather than invalid', () => {
    // The gateway always sets exp; an unsigned dev shim token may not. Refusing
    // it in middleware would strand a developer on the sign-in screen while the
    // gateway (which verifies) happily serves them.
    expect(readSessionCookie(token({ sub: 'usr_1' }), NOW).state).toBe('present');
  });

  it('reports invalid for a malformed token', () => {
    expect(readSessionCookie('not-a-jwt', NOW)).toEqual({ state: 'invalid' });
    expect(readSessionCookie('a.b', NOW)).toEqual({ state: 'invalid' });
    expect(readSessionCookie('a.!!!.c', NOW)).toEqual({ state: 'invalid' });
  });

  it('reports invalid when the payload is not JSON', () => {
    const header = Buffer.from('{}').toString('base64url');
    const body = Buffer.from('not json').toString('base64url');
    expect(readSessionCookie(`${header}.${body}.sig`, NOW)).toEqual({ state: 'invalid' });
  });

  it('does not verify the signature, so a forged token still reads as present', () => {
    // This is the documented contract: middleware is a redirect hint, not the
    // security boundary. The gateway rejects this token; middleware must not be
    // relied on to. Pinning it here stops someone "fixing" the module by
    // importing node:crypto, which would break the edge runtime.
    const forged = token({ sub: 'attacker', roles: ['chief_admin'], exp: future });
    expect(readSessionCookie(forged, NOW).state).toBe('present');
  });
});

describe('rolesFromClaim', () => {
  it('keeps only known roles', () => {
    expect(rolesFromClaim(['ops_manager', 'not_a_role', 'driver'])).toEqual(['ops_manager', 'driver']);
  });

  it('returns an empty list for a non-array', () => {
    expect(rolesFromClaim('ops_manager')).toEqual([]);
    expect(rolesFromClaim(undefined)).toEqual([]);
    expect(rolesFromClaim({ 0: 'ops_manager' })).toEqual([]);
  });
});

describe('parseCookieHeader', () => {
  it('parses pairs and skips malformed ones', () => {
    expect(parseCookieHeader('a=1; b=2; junk; =3')).toEqual({ a: '1', b: '2' });
  });

  it('returns an empty object for no header', () => {
    expect(parseCookieHeader(undefined)).toEqual({});
  });
});

describe('sessionCookieFromHeader', () => {
  it('prefers the session cookie', () => {
    expect(sessionCookieFromHeader(`${SESSION_COOKIE}=new; ${LEGACY_SESSION_COOKIE}=old`)).toBe('new');
  });

  it('falls back to the legacy cookie so a session issued before the rename still works', () => {
    expect(sessionCookieFromHeader(`${LEGACY_SESSION_COOKIE}=old`)).toBe('old');
  });

  it('returns undefined when neither is present', () => {
    expect(sessionCookieFromHeader('other=1')).toBeUndefined();
    expect(sessionCookieFromHeader(undefined)).toBeUndefined();
  });
});

describe('safeLocalPath', () => {
  it('accepts a local path', () => {
    expect(safeLocalPath('/orders/42')).toBe('/orders/42');
  });

  it('refuses a protocol-relative URL, which browsers treat as another origin', () => {
    expect(safeLocalPath('//evil.example')).toBe('/');
  });

  it('refuses the backslash variant that some browsers normalise to a slash', () => {
    expect(safeLocalPath('/\\evil.example')).toBe('/');
  });

  it('refuses an absolute URL', () => {
    expect(safeLocalPath('https://evil.example')).toBe('/');
  });

  it('refuses a path carrying a header injection', () => {
    expect(safeLocalPath('/a\r\nSet-Cookie: x=1')).toBe('/');
  });

  it('falls back for empty input', () => {
    expect(safeLocalPath(undefined)).toBe('/');
    expect(safeLocalPath('', '/home')).toBe('/home');
  });
});

describe('signInPath', () => {
  it('carries an encoded return path', () => {
    expect(signInPath('/orders/42')).toBe('/sign-in?returnTo=%2Forders%2F42');
  });

  it('never carries an off-site path', () => {
    expect(signInPath('//evil.example')).toBe('/sign-in?returnTo=%2F');
  });
});

describe('wrongPortal', () => {
  it('allows any caller when the portal accepts every role', () => {
    expect(wrongPortal({ roles: [] }, PORTAL_ROLES.storefront)).toBe(false);
  });

  it('rejects a caller with no role the portal serves', () => {
    expect(wrongPortal({ roles: ['customer_household'] }, PORTAL_ROLES['trade-portal'])).toBe(true);
  });

  it('accepts a caller holding one of the portal roles', () => {
    expect(wrongPortal({ roles: ['trade_buyer'] }, PORTAL_ROLES['trade-portal'])).toBe(false);
  });

  it('rejects a caller with no roles at all against a role-limited portal', () => {
    expect(wrongPortal({}, PORTAL_ROLES.admin)).toBe(true);
  });
});

describe('isPublicPath', () => {
  it('matches an exact path only, so /health does not expose /health/details', () => {
    expect(isPublicPath('/health', ['/health'])).toBe(true);
    expect(isPublicPath('/health/details', ['/health'])).toBe(false);
  });

  it('matches a subtree when the entry ends in /*', () => {
    expect(isPublicPath('/legal/privacy', ['/legal/*'])).toBe(true);
    expect(isPublicPath('/legal', ['/legal/*'])).toBe(false);
  });
});

describe('guardDecision', () => {
  const accepted = PORTAL_ROLES.admin;

  it('allows a public path with no session at all', () => {
    expect(guardDecision({ cookieHeader: undefined, pathname: '/health', accepted, publicPaths: ['/health'] }))
      .toEqual({ action: 'allow' });
  });

  it('sends an anonymous caller to sign-in, remembering where they were going', () => {
    expect(guardDecision({ cookieHeader: undefined, pathname: '/orders', search: '?page=2', accepted }))
      .toEqual({ action: 'sign-in', returnTo: '/orders?page=2' });
  });

  it('sends a caller whose session has expired to sign-in', () => {
    const cookie = `${SESSION_COOKIE}=${token({ roles: ['ops_manager'], exp: past })}`;
    expect(guardDecision({ cookieHeader: cookie, pathname: '/orders', accepted, nowMs: NOW }).action)
      .toBe('sign-in');
  });

  it('allows a signed-in caller whose role fits the portal', () => {
    const cookie = `${SESSION_COOKIE}=${token({ roles: ['ops_manager'], exp: future })}`;
    expect(guardDecision({ cookieHeader: cookie, pathname: '/orders', accepted, nowMs: NOW }))
      .toEqual({ action: 'allow' });
  });

  it('sends a signed-in caller with the wrong role to no-access, not to sign-in', () => {
    // Re-prompting someone who is already signed in would loop: they would sign
    // in again, get the same session, and be bounced again.
    const cookie = `${SESSION_COOKIE}=${token({ roles: ['customer_household'], exp: future })}`;
    expect(guardDecision({ cookieHeader: cookie, pathname: '/orders', accepted, nowMs: NOW }))
      .toEqual({ action: 'no-access' });
  });

  it('reads the legacy cookie name too, so a session from before the rename still works', () => {
    const cookie = `${LEGACY_SESSION_COOKIE}=${token({ roles: ['ops_manager'], exp: future })}`;
    expect(guardDecision({ cookieHeader: cookie, pathname: '/orders', accepted, nowMs: NOW }).action)
      .toBe('allow');
  });

  it('allows any signed-in caller in a portal that accepts every role', () => {
    const cookie = `${SESSION_COOKIE}=${token({ roles: ['customer_household'], exp: future })}`;
    expect(
      guardDecision({
        cookieHeader: cookie,
        pathname: '/cart',
        accepted: PORTAL_ROLES.storefront,
        nowMs: NOW,
      }),
    ).toEqual({ action: 'allow' });
  });
});

describe('guardDecisionGuardedOnly', () => {
  const guarded = ['/checkout', '/account', '/account/*'];

  it('allows an anonymous caller to browse the public shop', () => {
    expect(
      guardDecisionGuardedOnly({
        cookieHeader: undefined,
        pathname: '/product/lamb-chops',
        accepted: PORTAL_ROLES.storefront,
        guardedPaths: guarded,
      }),
    ).toEqual({ action: 'allow' });
  });

  it('sends an anonymous caller to sign-in at a guarded path', () => {
    expect(
      guardDecisionGuardedOnly({
        cookieHeader: undefined,
        pathname: '/checkout',
        accepted: PORTAL_ROLES.storefront,
        guardedPaths: guarded,
      }),
    ).toEqual({ action: 'sign-in', returnTo: '/checkout' });
  });

  it('guards a subtree', () => {
    expect(
      guardDecisionGuardedOnly({
        cookieHeader: undefined,
        pathname: '/account/orders',
        accepted: PORTAL_ROLES.storefront,
        guardedPaths: guarded,
      }).action,
    ).toBe('sign-in');
  });

  it('does not guard a path that merely starts with a guarded name', () => {
    // `/checkout-help` is a different page from `/checkout`.
    expect(
      guardDecisionGuardedOnly({
        cookieHeader: undefined,
        pathname: '/checkout-help',
        accepted: PORTAL_ROLES.storefront,
        guardedPaths: guarded,
      }),
    ).toEqual({ action: 'allow' });
  });

  it('allows a signed-in caller at a guarded path', () => {
    const cookie = `${SESSION_COOKIE}=${token({ roles: ['customer_household'], exp: future })}`;
    expect(
      guardDecisionGuardedOnly({
        cookieHeader: cookie,
        pathname: '/checkout',
        accepted: PORTAL_ROLES.storefront,
        guardedPaths: guarded,
        nowMs: NOW,
      }),
    ).toEqual({ action: 'allow' });
  });
});

describe('homePortalFor', () => {
  it('sends staff to admin', () => {
    expect(homePortalFor(['ops_manager'])).toBe('admin');
    expect(homePortalFor(['chief_admin'])).toBe('admin');
  });

  it('sends a trade user to the trade portal', () => {
    expect(homePortalFor(['trade_buyer'])).toBe('trade-portal');
  });

  it('prefers staff over a trade role, since a staff member may also hold a trade login', () => {
    expect(homePortalFor(['trade_owner', 'finance'])).toBe('admin');
  });

  it('routes each external role to its own portal', () => {
    expect(homePortalFor(['advertiser_user'])).toBe('advertiser-portal');
    expect(homePortalFor(['partner_user'])).toBe('partner-portal');
    expect(homePortalFor(['driver'])).toBe('driver-pwa');
  });

  it('sends a household customer to the storefront', () => {
    expect(homePortalFor(['customer_household'])).toBe('storefront');
  });

  it('defaults to the storefront with no roles', () => {
    expect(homePortalFor([])).toBe('/');
  });
});
