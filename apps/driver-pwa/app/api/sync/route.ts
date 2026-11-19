import { NextResponse } from 'next/server';
import type { DriverEventInput } from '@ag/api-client';
import type { QueuedEvent } from '../../../lib/offline-queue';
import { replayQueue, sendProof } from '../../../lib/gateway';
import { capturesByStop } from '../../../lib/proof-sync';

/**
 * Replay the driver's offline queue. The browser posts the queued events here
 * (same origin, so the httpOnly session cookie travels automatically); this
 * route forwards them to the gateway with the caller's bearer token, which
 * never reaches the browser bundle.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as { events?: DriverEventInput[] };
  const events = body.events ?? [];
  try {
    const result = await replayQueue(events);
    // The queue holds the proof as its own events; the service wants one capture
    // per stop, so the drops are folded back together and sent too. A proof that
    // fails is not fatal to the event sync: the service keeps the first capture
    // per stop, so the next sync simply retries it.
    const proofs = await sendProofs(events);
    return NextResponse.json({ ...result, proofs });
  } catch {
    return NextResponse.json({ accepted: 0, duplicates: 0, proofs: 0 }, { status: 502 });
  }
}

/** Post every stop's capture, counting the ones the server accepted. */
async function sendProofs(events: DriverEventInput[]): Promise<number> {
  const queued = events as unknown as QueuedEvent[];
  const captures = capturesByStop(queued);
  let stored = 0;
  for (const { stopId, capture } of captures) {
    try {
      await sendProof(stopId, capture);
      stored += 1;
    } catch {
      // A rejected capture is retried on the next sync; it must not fail the batch.
    }
  }
  return stored;
}
