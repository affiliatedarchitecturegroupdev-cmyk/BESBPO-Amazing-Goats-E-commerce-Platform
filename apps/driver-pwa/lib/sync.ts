import type { OfflineQueue } from './offline-queue';
/** Conflict rule: driver delivery events win for delivery status; the server wins for order content. */
export async function syncQueue(queue: OfflineQueue, post: (events: unknown[]) => Promise<void>): Promise<number> {
  const events = await queue.pending();
  if (events.length === 0) return 0;
  await post(events);
  await queue.markSynced(events.length);
  return events.length;
}
