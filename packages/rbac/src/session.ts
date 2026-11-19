import type { Role } from './roles';
import { ROLES } from './roles';


/**
 * The session cookie name and the rules for reading it in a portal (T-059).
 *
 * One constant, shared by the gateway that *writes* the cookie and the six apps
 * that *read* it. Before this, the gateway set `ag_session` while every app read
 * `ag_token`, so a completed sign-in set a cookie no portal looked at.
 *
 * This module is deliberately free of `node:crypto` so Next.js middleware can
 * import it: middleware runs on the edge runtime, where `node:crypto` is not
 * available. That constraint is why the middleware below does **not** verify the
 * token. It reads the cookie's presence and expiry only, to send a browser that
 * is obviously signed out to the sign-in screen. The security boundary is the
 * gateway, which verifies the JWT signature on every API call; a forged cookie
 * gets a 401 there and the portal's server-side guard turns that into a
 * redirect. A middleware check is a redirect optimisation, never an
 * authorisation decision.
 */

/** The httpOnly cookie the gateway sets on a successful sign-in. */
export const SESSION_COOKIE = 'ag_session';

/** The legacy cookie name the apps read before T-059. Read for one release. */
export const LEGACY_SESSION_COOKIE = 'ag_token';

/**
 * The claims a portal can read without verifying the signature. These are
 * *claims*, not proof: use them to render, never to authorise. `sub` and `roles`
 * are shown in a header; a permission check still belongs on the gateway.
 */
export interface SessionClaims {
  sub?: string;
  roles?: Role[];
  orgId?: string;
  email?: string;
  /** Unix seconds. */
  exp?: number;
  iat?: number;
}

/** The outcome of reading a session cookie. */
export type SessionRead =
  | { state: 'none' }
  | { state: 'expired' }
  | { state: 'invalid' }
  | { state: 'present'; claims: SessionClaims };

function base64UrlDecode(segment: string): string | undefined {
  try {
    // `atob` exists on the edge runtime and in Node 16+, so this stays portable.
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4));
    return decodeURIComponent(
      atob(padded + pad)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
  } catch {
    return undefined;
  }
}

/** Keep only role names we recognise, so a stray value cannot widen access. */
export function rolesFromClaim(value: unknown): Role[] {
  if (!Array.isArray(value)) return [];
  return value.filter((role): role is Role => (ROLES as readonly string[]).includes(role as string));
}

/**
 * Reads a session cookie without verifying it.
 *
 * The signature is *not* checked here — that needs `node:crypto`, which the edge
 * runtime lacks. Treat the result as a rendering hint: `present` means "there is
 * a token that has not expired", not "this caller is who the token says".
 */
export function readSessionCookie(
  raw: string | undefined,
  nowMs: number = Date.now(),
): SessionRead {
  if (!raw) return { state: 'none' };

  const parts = raw.split('.');
  if (parts.length !== 3) return { state: 'invalid' };

  const payload = base64UrlDecode(parts[1]);
  if (!payload) return { state: 'invalid' };

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return { state: 'invalid' };
  }

  const exp = typeof parsed.exp === 'number' ? parsed.exp : undefined;
  if (exp !== undefined && exp * 1000 <= nowMs) return { state: 'expired' };

  return {
    state: 'present',
    claims: {
      sub: typeof parsed.sub === 'string' ? parsed.sub : undefined,
      roles: rolesFromClaim(parsed.roles),
      orgId: typeof parsed.org_id === 'string' ? parsed.org_id : undefined,
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      exp,
      iat: typeof parsed.iat === 'number' ? parsed.iat : undefined,
    },
  };
}

/** The session cookie's value from a `Cookie` header, legacy name included. */
export function sessionCookieFromHeader(header: string | undefined): string | undefined {
  if (!header) return undefined;
  const jar = parseCookieHeader(header);
  return jar[SESSION_COOKIE] ?? jar[LEGACY_SESSION_COOKIE];
}

/** A minimal `Cookie` header parser. A malformed pair is skipped, not fatal. */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const pair of header.split(';')) {
    const index = pair.indexOf('=');
    if (index <= 0) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (name) out[name] = value;
  }
  return out;
}

/** Where to send a browser that has no usable session. */
export function signInPath(returnTo: string): string {
  return `/sign-in?returnTo=${encodeURIComponent(safeLocalPath(returnTo))}`;
}

/** The screen a signed-in caller sees when their roles do not fit this portal. */
export const NO_ACCESS_PATH = '/no-access';

/** What a portal's guard should do with a request. */
export type GuardOutcome =
  | { action: 'allow' }
  | { action: 'sign-in'; returnTo: string }
  | { action: 'no-access' };

/**
 * The guard rule every portal shares, as one pure function.
 *
 * Each app has its own `middleware.ts` because Next.js requires one per app, but
 * the *decision* lives here so six portals cannot drift into six different
 * answers. The inputs are deliberately primitive — a cookie header string and a
 * pathname — so this is testable without a server or a Next request object.
 *
 * As with `readSessionCookie`, this reads claims without verifying them. It
 * decides where to *redirect*, not what to *allow*: the gateway still rejects a
 * forged token on every data call, and each app's server-side `requireSession()`
 * asks the gateway before rendering a private page. Middleware that redirected
 * on an unverified cookie would be a nuisance; middleware that *authorised* on
 * one would be a vulnerability.
 */
export function guardDecision(input: {
  cookieHeader: string | undefined;
  pathname: string;
  search?: string;
  accepted: readonly Role[];
  publicPaths?: readonly string[];
  nowMs?: number;
}): GuardOutcome {
  const { cookieHeader, pathname, search = '', accepted, publicPaths = [], nowMs } = input;

  if (isPublicPath(pathname, publicPaths)) return { action: 'allow' };

  const read = readSessionCookie(sessionCookieFromHeader(cookieHeader), nowMs);
  if (read.state !== 'present') {
    return { action: 'sign-in', returnTo: `${pathname}${search}` };
  }
  if (wrongPortal(read.claims, accepted)) return { action: 'no-access' };
  return { action: 'allow' };
}

/**
 * Whether a path is public. A trailing `/*` matches a subtree; otherwise the
 * match is exact, so `/health` does not accidentally expose `/health/details`.
 */
export function isPublicPath(pathname: string, publicPaths: readonly string[]): boolean {
  return publicPaths.some((entry) =>
    entry.endsWith('/*') ? pathname.startsWith(entry.slice(0, -1)) : pathname === entry,
  );
}

/**
 * The guard for a portal that is *mostly* public, like the shop.
 *
 * A public shop cannot list every product route as "public" — the catalogue grows
 * — so it inverts the question: these few paths are guarded, everything else is
 * open. This is the same decision as `guardDecision`, with the polarity flipped,
 * kept separate so neither caller has to pass a "mode" flag and get it wrong.
 */
export function guardDecisionGuardedOnly(input: {
  cookieHeader: string | undefined;
  pathname: string;
  search?: string;
  accepted: readonly Role[];
  guardedPaths: readonly string[];
  nowMs?: number;
}): GuardOutcome {
  const { guardedPaths } = input;
  if (!isPublicPath(input.pathname, guardedPaths)) return { action: 'allow' };
  return guardDecision({ ...input, publicPaths: [] });
}

/**
 * A return path that cannot leave this site. `//evil.com` and `/\evil.com` are
 * both treated as protocol-relative by browsers, so a naive `startsWith('/')`
 * check would allow an open redirect.
 */
export function safeLocalPath(candidate: string | undefined, fallback = '/'): string {
  if (!candidate) return fallback;
  if (!candidate.startsWith('/')) return fallback;
  if (candidate.startsWith('//') || candidate.startsWith('/\\')) return fallback;
  if (/[\r\n\t]/.test(candidate)) return fallback;
  return candidate;
}

/**
 * Whether a portal should send this caller to the "no access" screen: there is a
 * session, but the caller's roles do not include any the portal accepts. An
 * empty `accepted` list means the portal takes any signed-in caller.
 */
export function wrongPortal(claims: SessionClaims, accepted: readonly Role[]): boolean {
  if (accepted.length === 0) return false;
  const roles = claims.roles ?? [];
  return !roles.some((role) => accepted.includes(role));
}

/**
 * The roles that use the office portals. `driver` is deliberately absent: a
 * driver is an employee, but works from the field app, never from admin.
 */
export const STAFF_PORTAL_ROLES: readonly Role[] = [
  'chief_admin',
  'executive',
  'ops_manager',
  'sales',
  'credit_controller',
  'finance',
  'procurement',
  'cold_room',
  'dispatch',
  'quality',
  'marketing',
  'support',
  'developer',
  'devops',
  'analyst',
];

/** The roles a portal serves, by the kind of caller it is for. */
export const PORTAL_ROLES: Record<string, readonly Role[]> = {
  storefront: [],
  'trade-portal': ['trade_owner', 'trade_buyer', 'trade_accounts'],
  admin: STAFF_PORTAL_ROLES,
  'advertiser-portal': ['advertiser_user'],
  'partner-portal': ['partner_user'],
  'driver-pwa': ['driver'],
};

/**
 * Which portal a caller belongs in, from their roles.
 *
 * This is deliberately *not* `isStaff`. That function answers a different
 * question — whether a session bypasses the org scope in row-level security —
 * and it requires every role to be non-external. Reusing it here would send a
 * driver to the admin portal (a driver is staff by that definition) and would
 * send a staff member who also holds a trade login to the trade portal. Portal
 * routing is about which app fits the person, so it reads the roles directly,
 * most specific first: office staff, then field driver, then the external
 * portals.
 */
export function homePortalFor(roles: readonly Role[]): string {
  if (roles.length === 0) return '/';
  if (roles.some((role) => STAFF_PORTAL_ROLES.includes(role))) return 'admin';
  if (roles.includes('driver')) return 'driver-pwa';
  if (roles.includes('trade_owner') || roles.includes('trade_buyer') || roles.includes('trade_accounts')) {
    return 'trade-portal';
  }
  if (roles.includes('advertiser_user')) return 'advertiser-portal';
  if (roles.includes('partner_user')) return 'partner-portal';
  return 'storefront';
}
