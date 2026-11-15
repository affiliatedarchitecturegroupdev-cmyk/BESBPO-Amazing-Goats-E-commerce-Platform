// T-035 core journey 2: cut-off edge cases.
//
// The cycle engine decides what a customer may still order and when the next
// cycle runs. These cases pin the boundaries that are easy to get wrong: the
// exact cut-off instant, the trade lock and top-up window, the 48-hour produce
// cut-off, the ambient same-day cut-off, and the weekly roll-over in the fixed
// SAST offset (Africa/Johannesburg is UTC+2 all year, so there is no DST gap).
import { describe, it, expect } from 'vitest';
import {
  ambientCutoff,
  chilledMeatCycle,
  eggsDairyProduceCycle,
  isOrderOpen,
  nextWeekly,
} from '../../services/commerce/src/cycles/cutoff';
import { assignCycle, buildOrder } from '../../services/commerce/src/orders/order-builder';
import type { CycleRecord } from '../../services/commerce/src/cycles/cycle-engine';
import type { Cart } from '../../services/commerce/src/orders/orders.types';

const CHILLED: Cart = {
  lines: [
    {
      sku: 'AG-LB-001',
      qty: 1,
      unitPriceExVatCents: 100_000,
      fulfilment: 'pre_order_cycle',
      temperature: 'chilled',
    },
  ],
};

describe('journey: cut-off edge cases', () => {
  it('closes the public window exactly at the cut-off instant', () => {
    const now = new Date('2026-11-16T08:00:00Z'); // Monday 10:00 SAST
    const cycle = chilledMeatCycle(now);
    expect(cycle.cutoffAt.toISOString()).toBe('2026-11-22T15:00:00.000Z'); // Sunday 17:00 SAST

    expect(isOrderOpen(cycle, new Date(cycle.cutoffAt.getTime() - 1), 'public')).toBe(true);
    expect(isOrderOpen(cycle, cycle.cutoffAt, 'public')).toBe(false);
    expect(isOrderOpen(cycle, new Date(cycle.cutoffAt.getTime() + 1), 'public')).toBe(false);
  });

  it('locks trade standing orders 5 hours before the public cut-off, top-up a day after', () => {
    const cycle = chilledMeatCycle(new Date('2026-11-16T08:00:00Z'));
    expect(cycle.tradeLockAt!.toISOString()).toBe('2026-11-22T10:00:00.000Z'); // Sunday 12:00 SAST
    expect(cycle.topUpUntil!.toISOString()).toBe('2026-11-23T10:00:00.000Z'); // Monday 12:00 SAST

    const justBeforeLock = new Date(cycle.tradeLockAt!.getTime() - 1);
    const atLock = cycle.tradeLockAt!;
    expect(isOrderOpen(cycle, justBeforeLock, 'trade')).toBe(true);
    expect(isOrderOpen(cycle, atLock, 'trade')).toBe(false);
    // A trade customer may still top up after the lock, but not after topUpUntil.
    expect(isOrderOpen(cycle, atLock, 'trade', true)).toBe(true);
    expect(isOrderOpen(cycle, cycle.topUpUntil!, 'trade', true)).toBe(false);
  });

  it('rolls a late order to the next weekly cycle', () => {
    const now = new Date('2026-11-16T08:00:00Z');
    const thisWeek = chilledMeatCycle(now);
    // A week later, the same query returns the following Sunday, not this one.
    const nextWeek = chilledMeatCycle(new Date('2026-11-23T08:00:00Z'));
    expect(nextWeek.cutoffAt.getTime() - thisWeek.cutoffAt.getTime()).toBe(7 * 24 * 3600 * 1000);

    // nextWeekly is strict: an instant exactly on the boundary rolls forward.
    const onBoundary = thisWeek.cutoffAt;
    expect(nextWeekly(onBoundary, 0, 17, 0).toISOString()).toBe(nextWeek.cutoffAt.toISOString());
  });

  it('assigns the soonest open cycle and skips one whose cut-off has passed', () => {
    const now = new Date('2026-11-16T08:00:00Z');
    const cycles: CycleRecord[] = [
      {
        id: 'closed',
        productClass: 'chilled_meat',
        cutoffAt: '2026-11-15T15:00:00.000Z',
        deliveryFrom: '2026-11-18T04:00:00.000Z',
        deliveryTo: '2026-11-20T16:00:00.000Z',
        status: 'closed',
      },
      {
        id: 'later',
        productClass: 'chilled_meat',
        cutoffAt: '2026-11-29T15:00:00.000Z',
        deliveryFrom: '2026-12-02T04:00:00.000Z',
        deliveryTo: '2026-12-04T16:00:00.000Z',
        status: 'open',
      },
      {
        id: 'sooner',
        productClass: 'chilled_meat',
        cutoffAt: '2026-11-22T15:00:00.000Z',
        deliveryFrom: '2026-11-25T04:00:00.000Z',
        deliveryTo: '2026-11-27T16:00:00.000Z',
        status: 'open',
      },
    ];
    expect(assignCycle(CHILLED.lines, cycles, now)?.id).toBe('sooner');
    expect(buildOrder(CHILLED, { id: 'ord', placedAt: now, cycles }).cycleId).toBe('sooner');
  });

  it('refuses a cycle order when every cycle is closed', () => {
    const now = new Date('2026-11-16T08:00:00Z');
    const cycles: CycleRecord[] = [
      {
        id: 'closed',
        productClass: 'chilled_meat',
        cutoffAt: '2026-11-15T15:00:00.000Z',
        deliveryFrom: '2026-11-18T04:00:00.000Z',
        deliveryTo: '2026-11-20T16:00:00.000Z',
        status: 'closed',
      },
    ];
    expect(() => buildOrder(CHILLED, { id: 'ord', placedAt: now, cycles })).toThrow(
      /no open cycle/,
    );
  });

  it('closes produce 48 hours before the route day', () => {
    const routeDay = new Date('2026-11-25T06:00:00Z'); // Wednesday
    const cycle = eggsDairyProduceCycle(routeDay);
    expect(cycle.cutoffAt.toISOString()).toBe('2026-11-23T06:00:00.000Z'); // Monday 08:00 SAST
    expect(isOrderOpen(cycle, new Date(cycle.cutoffAt.getTime() - 1), 'public')).toBe(true);
    expect(isOrderOpen(cycle, cycle.cutoffAt, 'public')).toBe(false);
  });

  it('gives ambient goods a same-day 15:00 SAST cut-off that rolls to tomorrow', () => {
    const morning = new Date('2026-11-16T08:00:00Z'); // Monday 10:00 SAST
    expect(ambientCutoff(morning).toISOString()).toBe('2026-11-16T13:00:00.000Z'); // Monday 15:00 SAST

    const evening = new Date('2026-11-16T14:00:00Z'); // Monday 16:00 SAST, after cut-off
    expect(ambientCutoff(evening).toISOString()).toBe('2026-11-17T13:00:00.000Z'); // Tuesday 15:00 SAST

    const onCutoff = new Date('2026-11-16T13:00:00Z'); // Monday 15:00 SAST exactly
    expect(ambientCutoff(onCutoff).toISOString()).toBe('2026-11-17T13:00:00.000Z');
  });
});
