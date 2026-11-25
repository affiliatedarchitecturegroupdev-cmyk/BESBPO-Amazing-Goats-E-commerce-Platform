import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@ag/api-client';
import { SESSION_COOKIE, LEGACY_SESSION_COOKIE } from '@ag/rbac';

/**
 * Signs the caller out (T-059).
 *
 * The gateway clears the httpOnly session cookie, but its response comes from
 * another origin, so the browser will not apply that `Set-Cookie` here. This
 * route therefore clears the cookies on this origin too. Clearing only here
 * would leave the gateway's refresh cookie alive, which is why both happen.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await createClient(BASE_URL).logout();
  } catch {
    // A caller asking to sign out must be signed out even if the gateway is
    // unreachable; the local cookies are cleared below regardless.
  }

  const response = NextResponse.redirect(new URL('/sign-in?signedOut=1', request.nextUrl.origin), 303);
  for (const name of [SESSION_COOKIE, LEGACY_SESSION_COOKIE]) {
    response.cookies.set(name, '', { path: '/', maxAge: 0 });
  }
  return response;
}

export const dynamic = 'force-dynamic';
