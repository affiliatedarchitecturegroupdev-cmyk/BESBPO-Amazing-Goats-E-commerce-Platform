import { NextResponse, type NextRequest } from 'next/server';
import { guardDecisionGuardedOnly, NO_ACCESS_PATH, PORTAL_ROLES } from '@ag/rbac';

/**
 * The shop's front door (T-059).
 *
 * The shop is public: browsing, searching and reading a product must work for
 * someone who has never signed in, and so must the legal pages. Only the paths
 * that act for a person are guarded — the cart, checkout and account. Guest
 * checkout stays available, which is why the sign-in screen offers "continue as
 * guest" rather than blocking the door.
 *
 * The guard reads the session cookie *without* verifying it, because middleware
 * runs on the edge runtime where `node:crypto` is unavailable. That is safe here
 * because it is a redirect decision, not an authorisation: the gateway verifies
 * the signature on every data call, and the guarded pages re-check through
 * `requireSession` on the server. A forged cookie gets past this file and is
 * rejected by both.
 */
const GUARDED_PATHS = ['/account', '/account/*', '/checkout', '/api/auth/*'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const outcome = guardDecisionGuardedOnly({
    cookieHeader: request.headers.get('cookie') ?? undefined,
    pathname,
    search,
    accepted: PORTAL_ROLES.storefront,
    guardedPaths: GUARDED_PATHS,
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
