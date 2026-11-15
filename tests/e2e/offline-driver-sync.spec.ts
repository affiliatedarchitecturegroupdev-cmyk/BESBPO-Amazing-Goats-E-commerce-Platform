// T-035 core journey 3: offline driver sync.
//
// A driver downloads the day pack in the morning, works with no signal all day,
// and syncs a whole batch when signal returns. This composes the driver app's
// offline queue and day pack with the logistics sync service, so the parts that
// only meet in production (queue shape, event ordering, idempotent replay) are
// exercised together.
import { describe, it, expect } from 'vitest';
import {
  MemoryQueue,
  withId,
  type QueuedEvent,
  type NewEvent,
} from '../../apps/driver-pwa/lib/offline-queue';
import {
  dayPackIsFresh,
  routeOrder,
  nextStop,
  type DayPack,
} from '../../apps/driver-pwa/lib/daypack';
import { DriverSyncService } from '../../services/logistics/src/driver-sync/driver-sync.service';
import { InMemorySyncEventStore } from '../../services/logistics/src/driver-sync/driver-sync.store';
import { isFullDayBatch } from '../../services/logistics/src/driver-sync/driver-sync-domain';
import type { DriverEvent } from '../../services/logistics/src/driver-sync/driver-sync.types';

const DEVICE = 'device-truck-1';
const MORNING = new Date('2026-11-18T05:00:00Z'); // Wednesday 07:00 SAST

const PACK: DayPack = {
  routeName: 'Wednesday north',
  downloadedAt: '2026-11-18T05:00:00.000Z',
  stops: [
    {
      id: 'stop-a',
      sequence: 1,
      customer: 'Cafe A',
      address: '1 Main',
      window: '06:00-07:00',
      items: [{ name: 'Lamb box', qty: 2 }],
      temperature: 'chilled',
      requiresSignature: true,
      cashExpectedCents: 0,
    },
    {
      id: 'stop-b',
      sequence: 2,
      customer: 'Bakery B',
      address: '2 Main',
      window: '07:00-08:00',
      items: [{ name: 'Eggs', qty: 12 }],
      temperature: 'ambient',
      requiresSignature: false,
      cashExpectedCents: 12_000,
    },
    {
      id: 'stop-c',
      sequence: 3,
      customer: 'Deli C',
      address: '3 Main',
      window: '08:00-09:00',
      items: [{ name: 'Cheese', qty: 5 }],
      temperature: 'chilled',
      requiresSignature: true,
      cashExpectedCents: 0,
    },
  ],
};

/** Map a queued app event onto the sync payload the service stores. */
function toDriverEvent(event: QueuedEvent): DriverEvent {
  const { type, stopId, at } = event;
  const payload: Record<string, unknown> = {};
  if (type === 'refused') payload.reason = event.reason;
  if (type === 'temperature') payload.celsius = event.celsius;
  if (type === 'cash') payload.amountCents = event.amountCents;
  return {
    id: event.id,
    deviceId: DEVICE,
    driverId: 'driver-1',
    type,
    stopId,
    occurredAt: at,
    payload,
  };
}

describe('journey: offline driver sync', () => {
  it('works from the downloaded pack and syncs the whole day in one batch', async () => {
    // The morning download is fresh for the day it was taken.
    expect(dayPackIsFresh(PACK, MORNING)).toBe(true);
    expect(routeOrder(PACK).map((s) => s.id)).toEqual(['stop-a', 'stop-b', 'stop-c']);
    expect(nextStop(PACK, 'stop-a')?.id).toBe('stop-b');

    // All day offline: the driver's actions land in the local queue.
    const queue = new MemoryQueue();
    const record = async (event: NewEvent) => queue.enqueue(withId(event));
    await record({ type: 'arrived', stopId: 'stop-a', at: '2026-11-18T06:00:00Z' });
    await record({ type: 'delivered', stopId: 'stop-a', at: '2026-11-18T06:05:00Z' });
    await record({
      type: 'temperature',
      stopId: 'stop-a',
      at: '2026-11-18T06:06:00Z',
      celsius: 3.4,
    });
    await record({ type: 'arrived', stopId: 'stop-b', at: '2026-11-18T07:00:00Z' });
    await record({
      type: 'cash',
      stopId: 'stop-b',
      at: '2026-11-18T07:10:00Z',
      amountCents: 12_000,
    });
    await record({ type: 'delivered', stopId: 'stop-b', at: '2026-11-18T07:12:00Z' });
    await record({ type: 'arrived', stopId: 'stop-c', at: '2026-11-18T08:00:00Z' });
    await record({
      type: 'refused',
      stopId: 'stop-c',
      at: '2026-11-18T08:05:00Z',
      reason: 'damaged',
    });

    const pending = await queue.pending();
    expect(pending).toHaveLength(8);
    expect(isFullDayBatch(pending, PACK.stops.length)).toBe(true);

    // Signal returns: the batch syncs and the queue clears.
    const logistics = new DriverSyncService(new InMemorySyncEventStore());
    const received = await logistics.receive(pending.map(toDriverEvent));
    expect(received).toEqual({ accepted: 8, duplicates: 0 });
    await queue.markSynced(pending.length);
    expect(await queue.pending()).toHaveLength(0);

    // Each stop resolves to the status its last delivery event set.
    expect(await logistics.deliveryStatus('stop-a')).toBe('delivered');
    expect(await logistics.deliveryStatus('stop-b')).toBe('delivered');
    expect(await logistics.deliveryStatus('stop-c')).toBe('refused');
  });

  it('is idempotent when the device retries the same batch', async () => {
    const logistics = new DriverSyncService(new InMemorySyncEventStore());
    const batch: DriverEvent[] = [
      {
        id: 'ev-1',
        deviceId: DEVICE,
        type: 'arrived',
        stopId: 'stop-a',
        occurredAt: '2026-11-18T06:00:00Z',
        payload: {},
      },
      {
        id: 'ev-2',
        deviceId: DEVICE,
        type: 'delivered',
        stopId: 'stop-a',
        occurredAt: '2026-11-18T06:05:00Z',
        payload: {},
      },
    ];

    expect(await logistics.receive(batch)).toEqual({ accepted: 2, duplicates: 0 });
    // The device lost the ack and retried: nothing is stored or applied twice.
    expect(await logistics.receive(batch)).toEqual({ accepted: 0, duplicates: 2 });
    expect(await logistics.list()).toHaveLength(2);
  });

  it('applies a late sync in the order events happened, not arrival order', async () => {
    const logistics = new DriverSyncService(new InMemorySyncEventStore());
    // Delivered is sent first but happened after arrived; ordering by occurredAt
    // keeps the conflict rule honest (the driver's events win for status).
    await logistics.receive([
      {
        id: 'ev-late',
        deviceId: DEVICE,
        type: 'delivered',
        stopId: 'stop-a',
        occurredAt: '2026-11-18T06:05:00Z',
        payload: {},
      },
      {
        id: 'ev-early',
        deviceId: DEVICE,
        type: 'arrived',
        stopId: 'stop-a',
        occurredAt: '2026-11-18T06:00:00Z',
        payload: {},
      },
    ]);
    expect(await logistics.deliveryStatus('stop-a')).toBe('delivered');
  });

  it('ignores a stale day pack from a previous day', () => {
    expect(dayPackIsFresh(PACK, new Date('2026-11-19T05:00:00Z'))).toBe(false);
    expect(dayPackIsFresh(undefined, MORNING)).toBe(false);
  });
});
