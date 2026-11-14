import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { applyDeliveryStatus, isFullDayBatch, orderEvents, receiveEvents } from './driver-sync-domain';
import { DriverSyncService } from './driver-sync.service';
import { InMemorySyncEventStore } from './driver-sync.store';
import { DriverEvent } from './driver-sync.types';

const ev = (over: Partial<DriverEvent> = {}): DriverEvent => ({
  id: 'e1', deviceId: 'dev-1', type: 'arrived', stopId: 's1',
  occurredAt: '2026-11-18T06:00:00Z', payload: {}, ...over,
});

describe('orderEvents', () => {
  it('sorts by time and breaks ties by id so replay is stable', () => {
    const events = [ev({ id: 'b', occurredAt: '2026-11-18T08:00:00Z' }), ev({ id: 'a', occurredAt: '2026-11-18T06:00:00Z' }), ev({ id: 'c', occurredAt: '2026-11-18T06:00:00Z' })];
    expect(orderEvents(events).map((e) => e.id)).toEqual(['a', 'c', 'b']);
  });
});

describe('receiveEvents', () => {
  it('accepts new events and counts repeats within a batch as duplicates', () => {
    const { accepted, duplicates, fresh } = receiveEvents([ev({ id: 'x' }), ev({ id: 'x' }), ev({ id: 'y' })], new Set());
    expect(accepted).toBe(2);
    expect(duplicates).toBe(1);
    expect(fresh.map((e) => e.id)).toEqual(['x', 'y']);
  });

  it('drops events already seen on a previous sync', () => {
    const { accepted, duplicates } = receiveEvents([ev({ id: 'x' }), ev({ id: 'z' })], new Set(['x']));
    expect(accepted).toBe(1);
    expect(duplicates).toBe(1);
  });
});

describe('applyDeliveryStatus', () => {
  it('lets driver delivery events win for delivery status', () => {
    expect(applyDeliveryStatus('pending', ev({ type: 'arrived' }))).toBe('arrived');
    expect(applyDeliveryStatus('arrived', ev({ type: 'delivered' }))).toBe('delivered');
    expect(applyDeliveryStatus('arrived', ev({ type: 'refused' }))).toBe('refused');
  });

  it('leaves the status alone for non-status events, since the server wins for content', () => {
    expect(applyDeliveryStatus('arrived', ev({ type: 'temperature' }))).toBe('arrived');
    expect(applyDeliveryStatus('arrived', ev({ type: 'cash' }))).toBe('arrived');
  });
});

describe('isFullDayBatch', () => {
  it('is true when a batch covers every stop and false when empty', () => {
    expect(isFullDayBatch([ev(), ev({ id: 'e2' })], 2)).toBe(true);
    expect(isFullDayBatch([], 0)).toBe(false);
  });
});

describe('DriverSyncService', () => {
  const build = () => new DriverSyncService(new InMemorySyncEventStore());

  it('accepts a batch then reports the rest as duplicates, so syncing twice is safe', async () => {
    const service = build();
    const batch = [ev({ id: 'a' }), ev({ id: 'b', type: 'delivered' })];
    expect(await service.receive(batch)).toEqual({ accepted: 2, duplicates: 0 });
    expect(await service.receive(batch)).toEqual({ accepted: 0, duplicates: 2 });
    expect(await service.list()).toHaveLength(2);
  });

  it('rejects an empty batch', async () => {
    await expect(build().receive([])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects events missing required fields', async () => {
    await expect(build().receive([ev({ deviceId: '' })])).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replays a stop into its delivery status, driver events winning', async () => {
    const service = build();
    await service.receive([
      ev({ id: 'a', stopId: 's1', type: 'arrived', occurredAt: '2026-11-18T06:00:00Z' }),
      ev({ id: 'b', stopId: 's1', type: 'temperature', occurredAt: '2026-11-18T06:05:00Z', payload: { celsius: 3.4 } }),
      ev({ id: 'c', stopId: 's1', type: 'delivered', occurredAt: '2026-11-18T06:10:00Z' }),
    ]);
    expect(await service.deliveryStatus('s1')).toBe('delivered');
    expect(await service.deliveryStatus('other')).toBe('pending');
  });
});

