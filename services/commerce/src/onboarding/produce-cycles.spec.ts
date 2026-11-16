import { describe, it, expect } from 'vitest';
import {
  PRODUCE_ROUTE_DOWS,
  nextOpenProduceCycle,
  produceCycleId,
  produceCycles,
  produceRouteDays,
} from './produce-cycles';

const HOUR = 3600 * 1000;

describe('produceRouteDays', () => {
  it('returns the next route days in ascending order', () => {
    // Monday 2026-05-04 12:00 UTC.
    const now = new Date('2026-05-04T12:00:00Z');
    const days = produceRouteDays(now, 4);
    expect(days.map((d) => d.toISOString())).toEqual([
      '2026-05-05T05:00:00.000Z', // Tuesday 07:00 SAST
      '2026-05-08T05:00:00.000Z', // Friday 07:00 SAST
      '2026-05-12T05:00:00.000Z',
      '2026-05-15T05:00:00.000Z',
    ]);
  });

  it('never returns a route day at or before now', () => {
    const now = new Date('2026-05-04T12:00:00Z');
    expect(produceRouteDays(now, 6).every((d) => d.getTime() > now.getTime())).toBe(true);
  });

  it('honours a custom route-day set', () => {
    const now = new Date('2026-05-04T12:00:00Z');
    // Monday only (dow 1).
    const days = produceRouteDays(now, 2, [1]);
    expect(days.map((d) => d.toISOString())).toEqual([
      '2026-05-11T05:00:00.000Z',
      '2026-05-18T05:00:00.000Z',
    ]);
  });

  it('defaults to the Tuesday and Friday routes', () => {
    expect(PRODUCE_ROUTE_DOWS).toEqual([2, 5]);
  });
});

describe('produceCycles', () => {
  const now = new Date('2026-05-04T12:00:00Z'); // Monday noon UTC

  it('closes orders 48 hours before the route day', () => {
    const [cycle] = produceCycles(now, 1);
    expect(cycle.routeDay.toISOString()).toBe('2026-05-05T05:00:00.000Z');
    expect(cycle.cutoffAt.getTime()).toBe(cycle.routeDay.getTime() - 48 * HOUR);
    expect(cycle.deliveryFrom.getTime()).toBe(cycle.routeDay.getTime());
  });

  it('marks a cycle whose cut-off has passed as closed', () => {
    // Tuesday route (2026-05-05) cut off on Sunday 2026-05-03, already past.
    const [tuesday] = produceCycles(now, 1);
    expect(tuesday.orderOpen).toBe(false);
  });

  it('marks an upcoming cycle as open', () => {
    const cycles = produceCycles(now, 2);
    expect(cycles[1].routeDay.toISOString()).toBe('2026-05-08T05:00:00.000Z');
    expect(cycles[1].orderOpen).toBe(true);
  });

  it('gives each cycle a deterministic id', () => {
    const routeDay = new Date('2026-05-08T05:00:00.000Z');
    expect(produceCycleId(routeDay)).toBe('produce:2026-05-08T05:00:00.000Z');
    expect(produceCycles(now, 2)[1].id).toBe(produceCycleId(new Date('2026-05-08T05:00:00.000Z')));
  });
});

describe('nextOpenProduceCycle', () => {
  it('returns the soonest cycle a public order can still join', () => {
    const now = new Date('2026-05-04T12:00:00Z');
    const cycle = nextOpenProduceCycle(now);
    expect(cycle?.routeDay.toISOString()).toBe('2026-05-08T05:00:00.000Z');
  });

  it('returns null when no upcoming cycle is open', () => {
    // A single route day that has already cut off: only one cycle is generated,
    // and it is closed.
    const now = new Date('2026-05-04T12:00:00Z');
    expect(nextOpenProduceCycle(now, 1, [2])).toBeNull();
  });
});
