import type { IDBPDatabase } from 'idb';
import type { OfflineQueue, QueuedEvent } from './offline-queue';
import { COMPLETED_STORE, EVENTS_STORE, KEYS_STORE, driverDbName, openDriverDb } from './driver-db';
import { generateQueueKey, queueCryptoAvailable, seal, unseal, type SealedRecord } from './queue-crypto';

/**
 * The durable queue (T-066). Every driver action is written to IndexedDB the
 * moment it happens, so closing the tab — or the phone dying in a low-signal
 * area — does not lose the day's captures.
 *
 * Two properties matter beyond durability:
 *
 * - **Encrypted at rest.** The value stored is an AES-GCM sealed event, never
 *   the event itself (`queue-crypto.ts`). The key is generated per install and
 *   non-extractable, so it cannot be read out of the page.
 * - **Ordered.** Records are keyed on an auto-incrementing cursor, so `pending`
 *   returns events in the order they were captured and a replay applies them in
 *   the order they happened. `markSynced(n)` trims exactly the first `n`.
 *
 * The database name carries the install's device id, so a re-enrolled device
 * cannot inherit the previous driver's queue.
 */
const KEY_ID = 'queue';

export interface IndexedDbQueueOptions {
  /** Device id, part of the database name so queues cannot cross devices. */
  deviceId: string;
  /** Override for tests; defaults to `ag-driver-<deviceId>`. */
  dbName?: string;
}

export class IndexedDbQueue implements OfflineQueue {
  private readonly dbName: string;
  private dbPromise?: Promise<IDBPDatabase>;
  private keyPromise?: Promise<CryptoKey>;

  constructor(options: IndexedDbQueueOptions) {
    this.dbName = options.dbName ?? driverDbName(options.deviceId);
  }

  private db(): Promise<IDBPDatabase> {
    this.dbPromise ??= openDriverDb(this.dbName);
    return this.dbPromise;
  }

  /**
   * The per-install key, created on first use and stored as a `CryptoKey`. It is
   * generated non-extractable, so this is the only way to get it back; a queue
   * with no key yet simply has nothing to decrypt.
   */
  private key(): Promise<CryptoKey> {
    this.keyPromise ??= (async () => {
      const db = await this.db();
      const stored = await db.get(KEYS_STORE, KEY_ID) as CryptoKey | undefined;
      if (stored) return stored;
      const created = await generateQueueKey();
      await db.put(KEYS_STORE, created, KEY_ID);
      return created;
    })();
    return this.keyPromise;
  }

  async enqueue(event: QueuedEvent): Promise<void> {
    const db = await this.db();
    const sealed = await seal(await this.key(), event);
    // No explicit key: the store's autoIncrement is the ordering.
    await db.add(EVENTS_STORE, sealed);
  }

  async pending(): Promise<QueuedEvent[]> {
    const db = await this.db();
    const keys = await db.getAllKeys(EVENTS_STORE);
    if (keys.length === 0) return [];

    const key = await this.key();
    const records = await db.getAll(EVENTS_STORE) as SealedRecord[];
    const events: QueuedEvent[] = [];
    for (const record of records) {
      events.push(await unseal<QueuedEvent>(key, record));
    }
    return events;
  }

  /** Trim the events the server accepted, leaving anything queued since. */
  async markSynced(count: number): Promise<void> {
    if (count <= 0) return;
    const db = await this.db();
    const keys = await db.getAllKeys(EVENTS_STORE);
    const tx = db.transaction(EVENTS_STORE, 'readwrite');
    // Sequential awaits inside one transaction, so the trim is atomic.
    for (const k of keys.slice(0, count)) await tx.store.delete(k);
    await tx.done;
  }

  async clear(): Promise<void> {
    const db = await this.db();
    await db.clear(EVENTS_STORE);
  }
}

/**
 * The queue the app should use. IndexedDB and WebCrypto are both required to
 * hold a driver's captures durably and encrypted; if either is missing (a very
 * old browser, or a non-browser test run) the caller gets `undefined` and can
 * fall back to `MemoryQueue` rather than storing plaintext.
 */
export function createQueue(deviceId: string): OfflineQueue | undefined {
  if (typeof indexedDB === 'undefined' || !queueCryptoAvailable()) return undefined;
  return new IndexedDbQueue({ deviceId });
}
