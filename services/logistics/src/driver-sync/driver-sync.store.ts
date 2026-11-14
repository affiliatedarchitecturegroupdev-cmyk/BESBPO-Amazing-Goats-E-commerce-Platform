import { DriverEvent } from './driver-sync.types';

/** Persistence boundary for driver sync events; the SQL adapter lands with the logistics store swap. */
export interface SyncEventStore {
  seen(id: string): Promise<boolean>;
  insert(event: DriverEvent): Promise<DriverEvent>;
  list(): Promise<DriverEvent[]>;
  markApplied(ids: string[]): Promise<void>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemorySyncEventStore implements SyncEventStore {
  private readonly byId = new Map<string, DriverEvent>();

  constructor(seed: DriverEvent[] = []) {
    for (const event of seed) this.byId.set(event.id, event);
  }

  async seen(id: string): Promise<boolean> {
    return this.byId.has(id);
  }

  async insert(event: DriverEvent): Promise<DriverEvent> {
    const stored = { ...event, receivedAt: event.receivedAt ?? new Date().toISOString(), applied: event.applied ?? false };
    this.byId.set(event.id, stored);
    return stored;
  }

  async list(): Promise<DriverEvent[]> {
    return [...this.byId.values()];
  }

  async markApplied(ids: string[]): Promise<void> {
    for (const id of ids) {
      const event = this.byId.get(id);
      if (event) this.byId.set(id, { ...event, applied: true });
    }
  }
}
