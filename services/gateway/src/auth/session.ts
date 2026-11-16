import type { AuthUser, JwtClaims } from '@ag/nest-auth';
import { verifyJwt, type JwtVerifyOptions } from '@ag/nest-auth';
import { isStaff } from '@ag/rbac';

/** What the session endpoint reports about the caller. */
export interface SessionView {
  user: AuthUser;
  staff: boolean;
  issuedAt: string | null;
  expiresAt: string | null;
  secondsRemaining: number | null;
}

/** The caller with the staff flag, as returned by `GET /gateway/auth/me`. */
export interface MeView extends AuthUser {
  staff: boolean;
}

function header(req: any, name: string): string | undefined {
  const v = req?.headers?.[name];
  return Array.isArray(v) ? v[0] : v;
}

/** The bearer token on the request, if any. */
export function bearerToken(req: any): string | undefined {
  const auth = header(req, 'authorization');
  if (!auth?.startsWith('Bearer ')) return undefined;
  return auth.slice('Bearer '.length).trim() || undefined;
}

/** The claims of a verified token, or undefined when it is absent or invalid. */
export function claimsFromRequest(req: any, opts: JwtVerifyOptions): JwtClaims | undefined {
  const token = bearerToken(req);
  if (!token) return undefined;
  try {
    return verifyJwt(token, opts);
  } catch {
    return undefined;
  }
}

const toIso = (seconds: number | undefined): string | null =>
  typeof seconds === 'number' && Number.isFinite(seconds) ? new Date(seconds * 1000).toISOString() : null;

/** Shaped view of the caller for the session endpoint. */
export function sessionView(user: AuthUser, claims: JwtClaims | undefined, now: Date): SessionView {
  const expiresAt = toIso(claims?.exp);
  const secondsRemaining =
    typeof claims?.exp === 'number' ? Math.max(0, claims.exp - Math.floor(now.getTime() / 1000)) : null;
  return {
    user,
    staff: isStaff(user.roles),
    issuedAt: toIso(claims?.iat),
    expiresAt,
    secondsRemaining,
  };
}

/** Shaped view of the caller for the identity endpoint. */
export function meView(user: AuthUser): MeView {
  return { ...user, staff: isStaff(user.roles) };
}
