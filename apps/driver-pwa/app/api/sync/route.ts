import { NextResponse } from 'next/server';
import type { DriverEventInput } from '@ag/api-client';
import { replayQueue } from '../../../lib/gateway';

/**
 * Replay the driver's offline queue. The browser posts the queued events here
 * (same origin, so the httpOnly session cookie travels automatically); this
 * route forwards them to the gateway with the caller's bearer token, which
 * never reaches the browser bundle.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { events?: DriverEventInput[] };
  try {
    const result = await replayQueue(body.events ?? []);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ accepted: 0, duplicates: 0 }, { status: 502 });
  }
}
