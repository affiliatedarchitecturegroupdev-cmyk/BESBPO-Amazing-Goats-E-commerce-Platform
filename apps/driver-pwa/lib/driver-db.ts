import { openDB, type IDBPDatabase } from 'idb';

/**
 * The one place the driver app's IndexedDB schema is declared.
 *
 * The queue and the day ledger share a database, and IndexedDB only runs an
 * `upgrade` when the *version* changes. If each module opened the database at
 * v1 with its own `upgrade`, whichever opened first would create only its own
 * stores and the other would then find them missing. So the schema lives here
 * and both open through it.
 *
 * Stores:
 * - `events`    — sealed queued events, auto-increment key = capture order.
 * - `keys`      — the per-install non-extractable AES key.
 * - `completed` — which stops are done today, keyed by stop id.
 */
export const DRIVER_DB_VERSION = 1;
export const EVENTS_STORE = 'events';
export const KEYS_STORE = 'keys';
export const COMPLETED_STORE = 'completed';

export function driverDbName(deviceId: string): string {
  return `ag-driver-${deviceId}`;
}

export function openDriverDb(dbName: string): Promise<IDBPDatabase> {
  return openDB(dbName, DRIVER_DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(EVENTS_STORE)) {
        db.createObjectStore(EVENTS_STORE, { autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE);
      }
      if (!db.objectStoreNames.contains(COMPLETED_STORE)) {
        db.createObjectStore(COMPLETED_STORE, { keyPath: 'stopId' });
      }
    },
  });
}
