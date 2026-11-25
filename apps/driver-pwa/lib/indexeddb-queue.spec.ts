// The durable queue (T-066). These tests drive the real IndexedDB path against
// `fake-indexeddb`, not a stub of our own: the point of the task is that a
// queued capture survives a reload, and only a real (fake) IndexedDB proves it.
//
// The WebCrypto key is non-extractable, which is the property that protects the
// queue, so the tests assert it rather than only asserting round-trip equality.
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndexedDbQueue, createQueue } from './indexeddb-queue';
import { MemoryQueue, withId, type QueuedEvent } from './offline-queue';
import { syncQueue } from './sync';
import { generateQueueKey, seal, unseal } from './queue-crypto';

const DB = 'ag-driver-dev-test';

/** Simulates a reload: a brand-new queue object over the same database. */
function reload(): IndexedDbQueue {
  return new IndexedDbQueue({ deviceId: 'dev-test', dbName: DB });
}

function arrived(stopId: string, at = '2026-11-18T06:00:00+02:00'): QueuedEvent {
  return withId({ type: 'arrived', stopId, at });
}

beforeEach(() => {
  // A fresh IndexedDB per test, so one test's queue cannot leak into the next.
  globalThis.indexedDB = new IDBFactory();
});

describe('IndexedDbQueue', () => {
  it('keeps a capture across a reload', async () => {
    const first = reload();
    await first.enqueue(arrived('cafe-a'));
    await first.enqueue(withId({ type: 'temperature', stopId: 'cafe-a', at: '2026-11-18T06:06:00+02:00', celsius: 3.4 }));

    const afterReload = reload();
    const events = await afterReload.pending();

    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({ type: 'arrived', stopId: 'cafe-a' });
    expect(events[1]).toMatchObject({ type: 'temperature', celsius: 3.4 });
  });

  it('drains in the order the events were captured', async () => {
    const q = reload();
    for (const stop of ['a', 'b', 'c', 'd']) await q.enqueue(arrived(stop));

    const drained = await q.pending();
    expect(drained.map((e) => (e as { stopId: string }).stopId)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('does not store the event in the clear', async () => {
    const q = reload();
    await q.enqueue(withId({ type: 'refused', stopId: 'secret-stop', at: '2026-11-18T06:00:00+02:00', reason: 'nobody home' }));

    // Read the raw record straight out of IndexedDB, bypassing the queue.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const raw = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction('events', 'readonly');
      const req = tx.objectStore('events').getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();

    const asText = JSON.stringify(raw);
    expect(asText).not.toContain('secret-stop');
    expect(asText).not.toContain('nobody home');
    expect(asText).toContain('ciphertext');
  });

  it('trims exactly the events the server accepted', async () => {
    const q = reload();
    await q.enqueue(arrived('a'));
    await q.enqueue(arrived('b'));
    await q.enqueue(arrived('c'));

    await q.markSynced(2);
    expect((await q.pending()).map((e) => (e as { stopId: string }).stopId)).toEqual(['c']);
  });

  it('keeps events queued while a sync was in flight', async () => {
    const q = reload();
    await q.enqueue(arrived('a'));
    await q.enqueue(arrived('b'));

    // The driver captures another stop before the post resolves.
    await q.enqueue(arrived('c'));
    await q.markSynced(2);

    expect((await q.pending()).map((e) => (e as { stopId: string }).stopId)).toEqual(['c']);
  });

  it('clears everything when the day closes', async () => {
    const q = reload();
    await q.enqueue(arrived('a'));
    await q.enqueue(arrived('b'));

    await q.clear();

    expect(await q.pending()).toEqual([]);
    expect(await reload().pending()).toEqual([]);
  });

  it('keeps the key across a reload, so a second session can still decrypt', async () => {
    await reload().enqueue(arrived('cafe-a'));

    // A different queue instance must decrypt what the first one wrote: the key
    // lives in IndexedDB, not in the object.
    const events = await reload().pending();
    expect(events).toHaveLength(1);
  });

  it('survives a reload then drains through syncQueue', async () => {
    const first = reload();
    await first.enqueue(arrived('cafe-a'));
    await first.enqueue(withId({ type: 'delivered', stopId: 'cafe-a', at: '2026-11-18T06:05:00+02:00' }));

    // Reload, then run the real drain path.
    const afterReload = reload();
    const posted: string[] = [];
    const count = await syncQueue(afterReload, async (events) => {
      posted.push(...events.map((e) => e.type));
    }, 'dev-test');

    expect(count).toBe(2);
    expect(posted).toEqual(['arrived', 'delivered']);
    expect(await reload().pending()).toEqual([]);
  });
});

describe('queue crypto', () => {
  it('generates a non-extractable key, so the page cannot read it back', async () => {
    const key = await generateQueueKey();
    expect(key.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('round-trips a value', async () => {
    const key = await generateQueueKey();
    const sealed = await seal(key, { hello: 'world', n: 3 });
    expect(await unseal(key, sealed)).toEqual({ hello: 'world', n: 3 });
  });

  it('refuses a tampered record rather than returning wrong data', async () => {
    const key = await generateQueueKey();
    const sealed = await seal(key, { type: 'delivered' });

    const bytes = new Uint8Array(sealed.ciphertext.slice(0));
    bytes[0] ^= 0xff;

    await expect(unseal(key, { iv: sealed.iv, ciphertext: bytes.buffer })).rejects.toThrow();
  });

  it('cannot be decrypted with a different install key', async () => {
    const sealed = await seal(await generateQueueKey(), { type: 'delivered' });
    const otherKey = await generateQueueKey();
    await expect(unseal(otherKey, sealed)).rejects.toThrow();
  });
});

describe('createQueue', () => {
  it('returns a durable queue when IndexedDB and WebCrypto are present', () => {
    expect(createQueue('dev-test')).toBeInstanceOf(IndexedDbQueue);
  });

  it('returns undefined rather than storing plaintext without WebCrypto', () => {
    const subtle = globalThis.crypto.subtle;
    // A browser without WebCrypto must not silently fall back to plaintext.
    Object.defineProperty(globalThis.crypto, 'subtle', { value: undefined, configurable: true });
    try {
      expect(createQueue('dev-test')).toBeUndefined();
    } finally {
      Object.defineProperty(globalThis.crypto, 'subtle', { value: subtle, configurable: true });
    }
  });
});

describe('MemoryQueue', () => {
  it('clears as well, so both queues satisfy the same interface', async () => {
    const q = new MemoryQueue();
    await q.enqueue(arrived('a'));
    await q.clear();
    expect(await q.pending()).toEqual([]);
  });
});
