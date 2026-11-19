import { NextResponse, type NextRequest } from 'next/server';
import { guardDecisionGuardedOnly, NO_ACCESS_PATH, PORTAL_ROLES } from '@ag/rbac';

/**
 * The shop's front door (T-059).
 *
 * The shop is public: browsing, searching, reading a product and the legal pages
 * must all work for someone who has never signed in. Checkout is public too — it
 * is built around guest checkout, reading a cart cookie and taking a name and
 * phone number on the page (`app/checkout/page.tsx`), so guarding it would stop
 * every first-time buyer. Only the account, which is by definition about a
 * signed-in person, is guarded.
 *
 * The guard reads the session cookie *without* verifying it, because middleware
 * runs on the edge runtime where `node:crypto` is unavailable. That is safe here
 * because it is a redirect decision, not an authorisation: the gateway verifies
 * the signature on every data call, and the guarded pages re-check through
 * `requireSession` on the server. A forged cookie gets past this file and is
 * rejected by both.
 */
const GUARDED_PATHS = ['/account', '/account/*'];

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
