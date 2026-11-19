import type { DayPack } from './daypack';
import { MemoryQueue, withId, type OfflineQueue, type QueuedEvent } from './offline-queue';
import { createQueue } from './indexeddb-queue';

/**
 * Fixtures only (T-050): the day pack the app falls back to when the gateway
 * cannot be reached (the driver is offline), and the demo queue that shows the
 * "events waiting" state. The live pack comes from `lib/gateway.ts`.
 */
export const FIXTURE_DAY_PACK: DayPack = {
  routeName: 'Wed Durban',
  downloadedAt: '2026-11-18T05:40:00+02:00',
  stops: [
    {
      id: 'cafe-a', sequence: 1, customer: 'Cafe A', address: '1 Long St, Durban', window: '08:00',
      items: [{ name: '10 kg lamb', qty: 1 }], temperature: 'chilled', requiresSignature: false,
      instructions: 'Side entrance, ask for Thandi.',
    },
    {
      id: 'bakery-b', sequence: 2, customer: 'Bakery B', address: '12 Main Rd, Durban', window: '08:30',
      items: [{ name: '20 egg trays', qty: 20 }], temperature: 'chilled', requiresSignature: true,
      cashExpectedCents: 12000, instructions: 'Back door, ring bell.',
    },
  ],
};

/** Device id used by the demo queue and the sync route. */
export const DEVICE_ID = 'dev-demo-1';

/**
 * The queue every screen writes to. On a real handset this is the durable,
 * encrypted IndexedDB queue (T-066), so a capture survives a closed tab; in a
 * non-browser run (a test, or server-side rendering) it falls back to memory.
 */
export const queue: OfflineQueue = createQueue(DEVICE_ID) ?? new MemoryQueue();

const seed: QueuedEvent[] = [
  withId({ type: 'arrived', stopId: 'cafe-a', at: '2026-11-18T06:00:00+02:00' }),
  withId({ type: 'delivered', stopId: 'cafe-a', at: '2026-11-18T06:05:00+02:00' }),
  withId({ type: 'temperature', stopId: 'cafe-a', at: '2026-11-18T06:06:00+02:00', celsius: 3.4 }),
  withId({ type: 'arrived', stopId: 'bakery-b', at: '2026-11-18T06:30:00+02:00' }),
  withId({ type: 'temperature', stopId: 'bakery-b', at: '2026-11-18T06:31:00+02:00', celsius: 3.8 }),
  withId({ type: 'cash', stopId: 'bakery-b', at: '2026-11-18T06:32:00+02:00', amountCents: 12000 }),
  withId({ type: 'delivered', stopId: 'bakery-b', at: '2026-11-18T06:33:00+02:00' }),
];

/**
 * Load the demo events once per session. With a durable queue "once per session"
 * is not enough — a reload would re-seed and duplicate the demo day — so the
 * seed is skipped when anything is already pending.
 */
export async function loadDemoQueue(): Promise<void> {
  if ((await queue.pending()).length > 0) return;
  for (const event of seed) await queue.enqueue(event);
}
