import { DeliveryStatus, DriverEvent, DriverEventType, ReceiveResult } from './driver-sync.types';

/** Delivery status the driver app reports, and the order they can happen in. */
const STATUS_EVENTS: Partial<Record<DriverEventType, DeliveryStatus>> = {
  arrived: 'arrived',
  delivered: 'delivered',
  refused: 'refused',
};

/** An event already applied once, matched by its client-generated UUID. */
export function isDuplicate(id: string, seen: Set<string>): boolean {
  return seen.has(id);
}

/**
 * Sort events into the order they happened so a late sync still applies in
 * sequence. Ties fall back to the id, which keeps replaying stable.
 */
export function orderEvents(events: DriverEvent[]): DriverEvent[] {
  return [...events].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.id.localeCompare(b.id));
}

/**
 * Conflict rule (docs/08-offline-driver.md): driver delivery events win for
 * delivery status; the server wins for order content. So only a delivery-status
 * event moves the status, and content fields are never taken from the driver.
 */
export function applyDeliveryStatus(current: DeliveryStatus, event: DriverEvent): DeliveryStatus {
  return STATUS_EVENTS[event.type] ?? current;
}

/**
 * Split a batch into events we have not seen yet and duplicates. An event is a
 * duplicate when its id is in `alreadySeen` (previous syncs) or repeats within the
 * batch. Returns the fresh events, in the order given, plus the counts.
 */
export function receiveEvents(
  events: DriverEvent[],
  alreadySeen: Set<string>,
): ReceiveResult & { fresh: DriverEvent[] } {
  const seen = new Set(alreadySeen);
  const fresh: DriverEvent[] = [];
  let duplicates = 0;
  for (const event of events) {
    if (isDuplicate(event.id, seen)) {
      duplicates += 1;
      continue;
    }
    seen.add(event.id);
    fresh.push(event);
  }
  return { accepted: fresh.length, duplicates, fresh };
}

/** A full offline day is many events per stop; the app must accept them in one batch. */
export function isFullDayBatch(events: DriverEvent[], stopCount: number): boolean {
  return stopCount > 0 && events.length >= stopCount;
}
