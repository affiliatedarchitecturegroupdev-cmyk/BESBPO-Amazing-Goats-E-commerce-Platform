import { signJwt } from '@ag/nest-auth';
import type { Role } from '@ag/rbac';

/**
 * Session cookies and token minting (T-058, `docs/01-architecture.md`: "keep
 * the token server-side only").
 *
 * Two cookies, both httpOnly so no script can read them:
 *
 * - the **session** is a short-lived HS256 JWT the guard already knows how to
 *   verify, so `userFromRequest` needs no change;
 * - the **refresh** is a random opaque value, not a token, so a stolen refresh
 *   cookie cannot be used against any other endpoint.
 *
 * Short session plus a longer refresh is what lets a staff member work all day
 * without the session living all day: the token a leaked log or a paused tab
 * exposes is good for minutes, not hours.
 */

export const SESSION_COOKIE = 'ag_session';
export const REFRESH_COOKIE = 'ag_refresh';
/** Carries the sealed PKCE state across the redirect to the IdP. */
export const STATE_COOKIE = 'ag_oidc_state';

export interface SessionConfig {
  secret: string;
  /** Minutes a session token is valid. Short by design. */
  sessionMinutes: number;
  /** Minutes a refresh is valid; also the longest a session can be renewed. */
  refreshMinutes: number;
  /** `Secure` must be off only for plain-HTTP local development. */
  secure: boolean;
  /** Cookie path; `/` unless the portal is mounted under a prefix. */
  path?: string;
}

export function sessionConfigFromEnv(env: NodeJS.ProcessEnv = process.env): SessionConfig {
  return {
    secret: env.JWT_SECRET ?? '',
    sessionMinutes: Number(env.SESSION_MINUTES ?? 15),
    refreshMinutes: Number(env.REFRESH_MINUTES ?? 480),
    // NODE_ENV is `production` on Northflank, where TLS terminates in front of
    // the pod, so the cookie must still carry `Secure`.
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

/** The claims the guard turns back into an `AuthUser`. */
export interface SessionClaims {
  sub: string;
  roles: Role[];
  org_id?: string;
  email?: string;
}

export function issueSession(claims: SessionClaims, config: SessionConfig, now: () => number = Date.now): string {
  const iat = Math.floor(now() / 1000);
  return signJwt(
    {
      ...claims,
      iss: undefined,
      exp: iat + Math.round(config.sessionMinutes * 60),
    },
    { secret: config.secret, now },
  );
}

/**
 * A cookie string. `sameSite=lax` rather than `strict` because the IdP redirects
 * back into the app with a top-level GET, and `strict` would withhold the cookie
 * on exactly that hop, breaking the callback.
 */
export function sessionCookie(token: string, config: SessionConfig): string {
  return serialize(SESSION_COOKIE, token, {
    maxAge: Math.round(config.sessionMinutes * 60),
    secure: config.secure,
    path: config.path ?? '/',
  });
}

export function refreshCookie(value: string, config: SessionConfig): string {
  return serialize(REFRESH_COOKIE, value, {
    maxAge: Math.round(config.refreshMinutes * 60),
    secure: config.secure,
    path: config.path ?? '/',
  });
}

/** The PKCE state is only needed for the few minutes a login takes. */
export function stateCookie(sealedState: string, config: SessionConfig): string {
  return serialize(STATE_COOKIE, sealedState, {
    maxAge: 10 * 60,
    secure: config.secure,
    path: config.path ?? '/',
  });
}

/** Clears a cookie: same attributes, empty value, already expired. */
export function clearCookie(name: string, config: SessionConfig): string {
  return serialize(name, '', {
    maxAge: 0,
    secure: config.secure,
    path: config.path ?? '/',
  });
}

function serialize(
  name: string,
  value: string,
  opts: { maxAge: number; secure: boolean; path: string },
): string {
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (opts.secure) parts.push('Secure');
  return parts.join('; ');
}

/**
 * Parses a `Cookie` header into a map. A malformed pair is skipped rather than
 * failing the request: a junk cookie from another app on the domain must not
 * break sign-in.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
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

/** Reads one cookie off a request, tolerating the array form Node can produce. */
export function cookieFromRequest(req: any, name: string): string | undefined {
  const raw = req?.headers?.cookie;
  const header = Array.isArray(raw) ? raw[0] : raw;
  return parseCookies(header)[name];
}

/**
 * Whether a refresh may still be honoured. Rotation keeps the *original* issue
 * time, so a session cannot be extended forever by refreshing repeatedly.
 */
export function refreshExpired(issuedAtMs: number, config: SessionConfig, now: () => number = Date.now): boolean {
  return now() - issuedAtMs >= config.refreshMinutes * 60_000;
}
