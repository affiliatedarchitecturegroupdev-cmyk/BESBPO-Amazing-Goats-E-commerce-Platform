import { NextResponse, type NextRequest } from 'next/server';
import { allowlistDecision, guardDecision, isPublicPath, NO_ACCESS_PATH, PORTAL_ROLES, signInPath } from '@ag/rbac';

/**
 * The admin portal's front door (T-058 allow-list, T-059 session guard).
 *
 * Two rules, in this order:
 *
 * 1. **The staff IP allow-list.** A caller off the approved networks is refused
 *    before anything else, so a blocked caller never reaches a screen that would
 *    read staff data. `/health` is exempt: the readiness probe comes from
 *    Northflank's own network, and a probe that failed off-site would restart a
 *    healthy service. It returns no data.
 * 2. **The session guard.** An anonymous caller is sent to sign-in; a signed-in
 *    caller whose roles do not fit this portal is sent to "no access".
 *
 * The guard reads the session cookie *without* verifying it, because middleware
 * runs on the edge runtime where `node:crypto` is unavailable. That is safe
 * because this is a redirect decision, not an authorisation: the gateway still
 * verifies the signature on every data call, and each page re-checks through
 * `requirePortalSession` on the server. A forged cookie gets past this file and
 * is rejected by both of those.
 */
const PUBLIC_PATHS = ['/health', '/sign-in', '/no-access', '/mfa', '/api/auth/*'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (!isPublicPath(pathname, PUBLIC_PATHS)) {
    const { allowed } = allowlistDecision(request.headers, process.env.ADMIN_IP_ALLOWLIST);
    if (!allowed) {
      return new NextResponse('Forbidden: this portal is restricted to approved networks.', {
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  }

  const outcome = guardDecision({
    cookieHeader: request.headers.get('cookie') ?? undefined,
    pathname,
    search,
    accepted: PORTAL_ROLES.admin,
    publicPaths: PUBLIC_PATHS,
  });

  if (outcome.action === 'sign-in') {
    const url = request.nextUrl.clone();
    url.pathname = '/sign-in';
    url.search = `?returnTo=${encodeURIComponent(outcome.returnTo)}`;
    return NextResponse.redirect(url);
  }

  if (outcome.action === 'no-access') {
    const url = request.nextUrl.clone();
    url.pathname = NO_ACCESS_PATH;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next.js internals and static assets; those carry no data.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
