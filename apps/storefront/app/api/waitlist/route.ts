import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@ag/api-client';

/**
 * The waitlist capture for an unserved delivery area (T-078).
 *
 * The waitlist is the newsletter list: subscribing is a double opt-in, so the
 * address is stored `pending` and receives nothing marketing until the person
 * clicks the confirmation link. Consent is therefore the gate, not this route.
 * The answer is always `accepted`, so the route cannot be used to discover
 * whether an address is already on the list.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export async function POST(request: NextRequest): Promise<NextResponse> {
  let email = '';
  let source = 'delivery-waitlist';
  try {
    const body = (await request.json()) as { email?: unknown; source?: unknown };
    if (typeof body.email === 'string') email = body.email;
    if (typeof body.source === 'string' && body.source.trim().length > 0) source = body.source.trim();
  } catch {
    // A malformed body still gets the same answer as a well-formed one.
  }

  try {
    await createClient(BASE_URL).joinWaitlist(email, source);
  } catch {
    // Never report an upstream failure differently from success: the answer must
    // not reveal anything about the address, and the person can try again.
  }
  return NextResponse.json({ status: 'accepted' }, { status: 202 });
}

export const dynamic = 'force-dynamic';
