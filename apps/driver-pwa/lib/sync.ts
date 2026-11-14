import type { OfflineQueue, QueuedEvent } from './offline-queue';

/** Server shape for a synced event, matching logistics.sync_events. */
export interface ServerEvent {
  id: string;
  deviceId: string;
  type: QueuedEvent['type'];
  stopId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

/** Flatten a queued event into the server shape, keeping the client-generated id. */
export function toServerEvent(event: QueuedEvent, deviceId: string): ServerEvent {
  const { type, id, stopId, at, ...rest } = event;
  return { id, deviceId, type, stopId, occurredAt: at, payload: rest };
}

/**
 * Post the pending queue and clear what the server accepted. The queue is only
 * trimmed when the post resolves, so a failed sync keeps every event for the next
 * attempt. Returns how many events were synced.
 */
export async function syncQueue(
  queue: OfflineQueue,
  post: (events: ServerEvent[]) => Promise<void>,
  deviceId = 'unknown-device',
): Promise<number> {
  const events = await queue.pending();
  if (events.length === 0) return 0;
  await post(events.map((e) => toServerEvent(e, deviceId)));
  await queue.markSynced(events.length);
  return events.length;
}
