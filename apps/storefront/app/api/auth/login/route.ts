import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@ag/api-client';
import { safeLocalPath } from '@ag/rbac';

/**
 * Forwards the browser to the gateway's sign-in (T-059).
 *
 * The gateway's address is a server environment variable, so this route exists
 * so the browser is never given it. It is a redirect, not a fetch: the identity
 * provider needs a top-level navigation to show its own screen and set its
 * cookies.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export function GET(request: NextRequest): NextResponse {
  const returnTo = safeLocalPath(request.nextUrl.searchParams.get('returnTo') ?? '/');
  const url = createClient(BASE_URL).loginUrl(returnTo);
  return NextResponse.redirect(url, 303);
}

export const dynamic = 'force-dynamic';
