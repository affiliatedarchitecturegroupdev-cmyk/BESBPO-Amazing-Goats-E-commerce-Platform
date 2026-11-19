import type { IDBPDatabase } from 'idb';
import { COMPLETED_STORE, driverDbName, openDriverDb } from './driver-db';

/**
 * Which stops the driver has finished today (T-066).
 *
 * This is deliberately *not* the queue. The queue is cleared once the server
 * confirms a sync, so deriving "what have I done" from it would reset the route
 * to zero stops delivered every time signal came back — and would make day-close
 * impossible to satisfy, since it requires an empty queue and a full route at
 * the same time.
 *
 * The ledger is small (stop ids only), survives a reload, and is cleared with
 * the queue when the day closes.
 */
export type StopOutcome = 'delivered' | 'refused';

export interface CompletedStop {
  stopId: string;
  outcome: StopOutcome;
  at: string;
}

export interface DayLedger {
  record(stopId: string, outcome: StopOutcome, at: string): Promise<void>;
  all(): Promise<CompletedStop[]>;
  clear(): Promise<void>;
}

export class IndexedDbDayLedger implements DayLedger {
  private readonly dbName: string;
  private dbPromise?: Promise<IDBPDatabase>;

  constructor(options: { deviceId: string; dbName?: string }) {
    this.dbName = options.dbName ?? driverDbName(options.deviceId);
  }

  private db(): Promise<IDBPDatabase> {
    this.dbPromise ??= openDriverDb(this.dbName);
    return this.dbPromise;
  }

  /** Upsert on `stopId`, so re-recording a stop is idempotent. */
  async record(stopId: string, outcome: StopOutcome, at: string): Promise<void> {
    const db = await this.db();
    await db.put(COMPLETED_STORE, { stopId, outcome, at } satisfies CompletedStop);
  }

  async all(): Promise<CompletedStop[]> {
    const db = await this.db();
    return (await db.getAll(COMPLETED_STORE)) as CompletedStop[];
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await db.clear(COMPLETED_STORE);
  }
}

/** An in-memory ledger for tests and for a browser without IndexedDB. */
export class MemoryDayLedger implements DayLedger {
  private items = new Map<string, CompletedStop>();
  async record(stopId: string, outcome: StopOutcome, at: string) {
    this.items.set(stopId, { stopId, outcome, at });
  }
  async all() { return [...this.items.values()]; }
  async clear() { this.items.clear(); }
}

export function createLedger(deviceId: string): DayLedger {
  return typeof indexedDB === 'undefined'
    ? new MemoryDayLedger()
    : new IndexedDbDayLedger({ deviceId });
}
