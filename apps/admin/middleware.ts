import { NextResponse, type NextRequest } from 'next/server';
import { allowlistDecision } from '@ag/rbac';

/**
 * Enforces the staff IP allow-list on every admin request (T-058/T-067,
 * `docs/02-access-control.md`).
 *
 * This runs in the edge runtime, before any page or route handler, so a blocked
 * caller never reaches a screen that would read staff data through the gateway.
 *
 * `/health` is exempt: the platform's readiness probe comes from Northflank's
 * own network, not the office, and a probe that fails because it is off-site
 * would restart a perfectly healthy service. It returns no data.
 */
const PUBLIC_PATHS = ['/health'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const { allowed } = allowlistDecision(request.headers, process.env.ADMIN_IP_ALLOWLIST);
  if (allowed) return NextResponse.next();

  return new NextResponse('Forbidden: this portal is restricted to approved networks.', {
    status: 403,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export const config = {
  // Everything except Next.js internals and static assets; those carry no data.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
