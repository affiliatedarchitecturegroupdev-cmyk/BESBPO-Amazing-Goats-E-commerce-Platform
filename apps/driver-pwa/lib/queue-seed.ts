import { MemoryQueue, withId, type QueuedEvent } from './offline-queue';

/**
 * Demo queue for local runs, until the queue is backed by IndexedDB and fed by
 * real driver actions. Holds the morning's events so the sync screen shows the
 * same "events waiting" state as the wireframe.
 */
export const queue: MemoryQueue = new MemoryQueue();

const seed: QueuedEvent[] = [
  withId({ type: 'arrived', stopId: 'cafe-a', at: '2026-11-18T06:00:00+02:00' }),
  withId({ type: 'delivered', stopId: 'cafe-a', at: '2026-11-18T06:05:00+02:00' }),
  withId({ type: 'temperature', stopId: 'cafe-a', at: '2026-11-18T06:06:00+02:00', celsius: 3.4 }),
  withId({ type: 'arrived', stopId: 'bakery-b', at: '2026-11-18T06:30:00+02:00' }),
  withId({ type: 'temperature', stopId: 'bakery-b', at: '2026-11-18T06:31:00+02:00', celsius: 3.8 }),
  withId({ type: 'cash', stopId: 'bakery-b', at: '2026-11-18T06:32:00+02:00', amountCents: 12000 }),
  withId({ type: 'delivered', stopId: 'bakery-b', at: '2026-11-18T06:33:00+02:00' }),
];

let loaded = false;
/** Load the demo events once per session, so refreshes do not duplicate them. */
export async function loadDemoQueue(): Promise<void> {
  if (loaded) return;
  loaded = true;
  for (const event of seed) await queue.enqueue(event);
}
