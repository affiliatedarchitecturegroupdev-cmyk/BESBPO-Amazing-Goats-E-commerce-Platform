import { NextResponse, type NextRequest } from 'next/server';
import { createClient, type AreaCheck } from '@ag/api-client';
import { AreaCheckCache, isAskable } from '../../../lib/area-check-cache';

/**
 * The browser's door to the delivery-area check (T-078).
 *
 * The gateway's address is a server variable, so the browser asks this route and
 * never learns it. The answer is cached per area here, in the server process, so
 * typing a suburb one character at a time costs one upstream call per settled
 * area rather than one per keystroke.
 */
const BASE_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

/** One cache per server process: the fee and the slots are the same for everyone. */
const cache = new AreaCheckCache();

export async function GET(request: NextRequest): Promise<NextResponse> {
  const params = request.nextUrl.searchParams;
  const postalCode = params.get('postalCode') ?? undefined;
  const suburb = params.get('suburb') ?? undefined;
  const rawTotal = params.get('goodsTotalCents');
  const total = rawTotal === null ? undefined : Number(rawTotal);
  const goodsTotalCents = total !== undefined && Number.isFinite(total) ? total : undefined;

  const area = { postalCode, suburb, goodsTotalCents };
  if (!isAskable(area)) {
    const answer: AreaCheck = { served: false, area: '', needsArea: true, waitlist: { available: true } };
    return NextResponse.json(answer);
  }

  try {
    const answer = await cache.resolve(area, (q) => createClient(BASE_URL).areaCheck(q));
    return NextResponse.json(answer);
  } catch {
    // An upstream failure is not an answer about the area, so it is not cached
    // and it is not dressed up as one: the page falls back to asking again.
    return NextResponse.json(
      { served: false, area: suburb ?? postalCode ?? '', needsArea: false, waitlist: { available: true } },
      { status: 502 },
    );
  }
}

export const dynamic = 'force-dynamic';
