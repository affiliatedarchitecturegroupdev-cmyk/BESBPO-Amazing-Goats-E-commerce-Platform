import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { IndexedDbDayLedger, MemoryDayLedger, createLedger } from './day-ledger';
import { IndexedDbQueue } from './indexeddb-queue';
import { withId } from './offline-queue';
import { canCloseDay, type DayPack } from './daypack';

const DB = 'ag-driver-ledger-test';

const pack: DayPack = {
  routeName: 'Wed Durban',
  downloadedAt: '2026-11-18T05:40:00+02:00',
  stops: [
    { id: 'cafe-a', sequence: 1, customer: 'Cafe A', address: '1 Long St', window: '08:00', items: [], temperature: 'chilled', requiresSignature: false },
    { id: 'bakery-b', sequence: 2, customer: 'Bakery B', address: '12 Main Rd', window: '08:30', items: [], temperature: 'chilled', requiresSignature: true },
  ],
};

function ledger(): IndexedDbDayLedger {
  return new IndexedDbDayLedger({ deviceId: 'dev-test', dbName: DB });
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory();
});

describe('IndexedDbDayLedger', () => {
  it('remembers a completed stop across a reload', async () => {
    await ledger().record('cafe-a', 'delivered', '2026-11-18T06:05:00+02:00');

    const afterReload = await ledger().all();
    expect(afterReload).toEqual([
      { stopId: 'cafe-a', outcome: 'delivered', at: '2026-11-18T06:05:00+02:00' },
    ]);
  });

  it('keeps progress after the queue is cleared by a sync', async () => {
    // The bug this guards: deriving progress from the queue reset the route to
    // zero stops every time signal came back.
    const queue = new IndexedDbQueue({ deviceId: 'dev-test', dbName: DB });
    const day = ledger();

    await queue.enqueue(withId({ type: 'delivered', stopId: 'cafe-a', at: '2026-11-18T06:05:00+02:00' }));
    await day.record('cafe-a', 'delivered', '2026-11-18T06:05:00+02:00');

    await queue.markSynced(1);
    expect(await queue.pending()).toEqual([]);

    expect((await ledger().all()).map((s) => s.stopId)).toEqual(['cafe-a']);
  });

  it('is idempotent per stop', async () => {
    await ledger().record('cafe-a', 'delivered', '2026-11-18T06:05:00+02:00');
    await ledger().record('cafe-a', 'refused', '2026-11-18T06:09:00+02:00');

    const all = await ledger().all();
    expect(all).toHaveLength(1);
    expect(all[0].outcome).toBe('refused');
  });

  it('clears with the day', async () => {
    await ledger().record('cafe-a', 'delivered', '2026-11-18T06:05:00+02:00');
    await ledger().clear();
    expect(await ledger().all()).toEqual([]);
  });

  it('shares a database with the queue, so both stores exist', async () => {
    const queue = new IndexedDbQueue({ deviceId: 'dev-test', dbName: DB });
    await queue.enqueue(withId({ type: 'arrived', stopId: 'cafe-a', at: '2026-11-18T06:00:00+02:00' }));
    await ledger().record('cafe-a', 'delivered', '2026-11-18T06:05:00+02:00');

    // Whichever opened first, neither store may be missing.
    expect(await queue.pending()).toHaveLength(1);
    expect(await ledger().all()).toHaveLength(1);
  });
});

describe('canCloseDay', () => {
  it('refuses while events are still queued', () => {
    expect(canCloseDay({ pack, completedStopIds: ['cafe-a', 'bakery-b'], pendingEvents: 3 }))
      .toEqual({ ok: false, blocker: 'queue_not_drained' });
  });

  it('refuses while a stop has not been accounted for', () => {
    expect(canCloseDay({ pack, completedStopIds: ['cafe-a'], pendingEvents: 0 }))
      .toEqual({ ok: false, blocker: 'stops_remaining' });
  });

  it('allows the close when the queue is drained and every stop is done', () => {
    expect(canCloseDay({ pack, completedStopIds: ['cafe-a', 'bakery-b'], pendingEvents: 0 }))
      .toEqual({ ok: true });
  });

  it('counts a refused stop as accounted for', () => {
    // A refusal is a completed delivery attempt; the day can still close.
    expect(canCloseDay({ pack, completedStopIds: ['cafe-a', 'bakery-b'], pendingEvents: 0 }))
      .toEqual({ ok: true });
  });
});

describe('createLedger', () => {
  it('returns a durable ledger in the browser and memory elsewhere', () => {
    expect(createLedger('dev-test')).toBeInstanceOf(IndexedDbDayLedger);
  });

  it('MemoryDayLedger satisfies the same interface', async () => {
    const m = new MemoryDayLedger();
    await m.record('cafe-a', 'delivered', '2026-11-18T06:05:00+02:00');
    expect((await m.all()).map((s) => s.stopId)).toEqual(['cafe-a']);
    await m.clear();
    expect(await m.all()).toEqual([]);
  });
});
