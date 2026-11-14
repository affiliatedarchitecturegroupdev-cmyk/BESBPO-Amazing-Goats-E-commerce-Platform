// Offline-first queue. Every driver action is stored locally, then synced when signal returns.
export type QueuedEvent =
  | { type: 'arrived'; stopId: string; at: string }
  | { type: 'delivered'; stopId: string; at: string; signatureDataUrl?: string; photoIds?: string[] }
  | { type: 'refused'; stopId: string; at: string; reason: string }
  | { type: 'temperature'; stopId: string; at: string; celsius: number }
  | { type: 'cash'; stopId: string; at: string; amountCents: number };

export interface OfflineQueue { enqueue(e: QueuedEvent): Promise<void>; pending(): Promise<QueuedEvent[]>; markSynced(count: number): Promise<void> }

/** TODO(T-021): back this with IndexedDB (idb), encrypt at rest, and clear after the day closes. */
export class MemoryQueue implements OfflineQueue {
  private items: QueuedEvent[] = [];
  async enqueue(e: QueuedEvent) { this.items.push(e); }
  async pending() { return [...this.items]; }
  async markSynced(count: number) { this.items = this.items.slice(count); }
}
