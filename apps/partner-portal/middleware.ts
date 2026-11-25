import { NextResponse, type NextRequest } from 'next/server';
import { guardDecision, NO_ACCESS_PATH, PORTAL_ROLES } from '@ag/rbac';

/**
 * The partner-portal front door (T-059).
 *
 * Every screen is for a signed-in partner, so the whole app is guarded.
 *
 * The guard reads the session cookie *without* verifying it, because middleware
 * runs on the edge runtime where `node:crypto` is unavailable. That is safe here
 * because it is a redirect decision, not an authorisation: the gateway verifies
 * the signature on every data call, and each page re-checks through
 * `requirePortalSession` on the server. A forged cookie gets past this file and is
 * rejected by both.
 */
const PUBLIC_PATHS = ['/health', '/sign-in', '/no-access', '/mfa', '/api/auth/*'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const outcome = guardDecision({
    cookieHeader: request.headers.get('cookie') ?? undefined,
    pathname,
    search,
    accepted: PORTAL_ROLES['partner-portal'],
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
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
