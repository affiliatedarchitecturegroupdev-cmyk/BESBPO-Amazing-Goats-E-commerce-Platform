import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient, type SessionView } from '@ag/api-client';
import {
  LEGACY_SESSION_COOKIE,
  NO_ACCESS_PATH,
  PORTAL_ROLES,
  SESSION_COOKIE,
  safeLocalPath,
  signInPath,
  wrongPortal,
  type Role,
} from '@ag/rbac';

/**
 * The server-side half of the session guard (T-059).
 *
 * This file is duplicated in each app because Next.js resolves `next/headers`
 * per app, but it is deliberately thin: every *decision* lives in `@ag/rbac`
 * (`wrongPortal`, `safeLocalPath`) and is tested there once. What stays here is
 * only the plumbing that needs a request context.
 *
 * `middleware.ts` runs on the edge runtime, where the JWT cannot be verified, so
 * it only redirects on an unverified cookie. This module is where the caller is
 * actually checked: it asks the gateway, which verifies the signature. A forged
 * cookie passes middleware and then fails here.
 */

const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

/** The raw session cookie value, from either the current or the legacy name. */
export function sessionCookie(): string | undefined {
  const jar = cookies();
  return jar.get(SESSION_COOKIE)?.value ?? jar.get(LEGACY_SESSION_COOKIE)?.value;
}

/** A gateway client carrying the caller's session, for server-side reads. */
export function sessionClient() {
  const token = sessionCookie();
  return createClient(BASE_URL, token ? () => ({ authorization: `Bearer ${token}` }) : () => ({}));
}

/**
 * The caller as the gateway sees them, or undefined when there is no valid
 * session. The gateway verified the signature, so this is the trusted answer.
 */
export async function currentSession(): Promise<SessionView | undefined> {
  if (!sessionCookie()) return undefined;
  try {
    return await sessionClient().session();
  } catch {
    // A 401 is the normal signed-out answer; a gateway that is down is also not
    // a session. Neither should be shown to the caller as "your login is bad".
    return undefined;
  }
}

/** The caller, or a redirect to sign-in that remembers where they were going. */
export async function requireSession(returnTo = '/'): Promise<SessionView> {
  const session = await currentSession();
  if (!session) redirect(signInPath(returnTo));
  return session;
}

/**
 * The caller, or a redirect to sign-in, then to "no access" when their roles do
 * not fit this portal. For a portal with a fixed audience.
 */
export async function requirePortalSession(
  portal: keyof typeof PORTAL_ROLES,
  returnTo = '/',
): Promise<SessionView> {
  const session = await requireSession(returnTo);
  const accepted = PORTAL_ROLES[portal] ?? [];
  if (wrongPortal({ roles: session.user.roles as Role[] }, accepted)) redirect(NO_ACCESS_PATH);
  return session;
}

/** The return path from a sign-in query string, made safe to redirect to. */
export function returnToFrom(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return safeLocalPath(raw);
}
