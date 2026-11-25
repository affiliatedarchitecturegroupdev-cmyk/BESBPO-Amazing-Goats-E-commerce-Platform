// Offline-first queue. Every driver action is stored locally, then synced when signal returns.
export type QueuedEvent =
  | { type: 'arrived'; id: string; stopId: string; at: string }
  | { type: 'delivered'; id: string; stopId: string; at: string; signatureDataUrl?: string; photoIds?: string[] }
  | { type: 'refused'; id: string; stopId: string; at: string; reason: string }
  | { type: 'temperature'; id: string; stopId: string; at: string; celsius: number }
  | { type: 'cash'; id: string; stopId: string; at: string; amountCents: number };

/** Omit that distributes over a union, so each event keeps its own fields. */
type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never;

/** Event without its id, which the queue adds. */
export type NewEvent = DistributiveOmit<QueuedEvent, 'id'>;

export interface OfflineQueue {
  enqueue(e: QueuedEvent): Promise<void>;
  pending(): Promise<QueuedEvent[]>;
  markSynced(count: number): Promise<void>;
  /** Drop everything — the day is closed, or the device is wiped. */
  clear(): Promise<void>;
}

/** Client-generated UUID so replaying a sync never applies the same event twice. */
export function newId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function withId(event: NewEvent): QueuedEvent {
  return { ...event, id: newId() } as QueuedEvent;
}

/**
 * The in-memory queue. Kept for tests and for a browser with no IndexedDB, but
 * a driver's captures must survive a closed tab, so the app uses
 * `IndexedDbQueue` (T-066).
 */
export class MemoryQueue implements OfflineQueue {
  private items: QueuedEvent[] = [];
  async enqueue(e: QueuedEvent) { this.items.push(e); }
  async pending() { return [...this.items]; }
  async markSynced(count: number) { this.items = this.items.slice(count); }
  async clear() { this.items = []; }
}
