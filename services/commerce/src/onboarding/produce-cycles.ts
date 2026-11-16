// Produce pre-order cycles (T-033). Eggs, dairy and produce are ordered by a
// cut-off 48 hours before the route day (docs/04-cutoff-engine.md), so a produce
// cycle is a route day plus the standard eggs/dairy/produce cut-off. Everything
// here is a pure function of `now`, so the API, the storefront and the scheduler
// agree on what is open.

import { Cycle, eggsDairyProduceCycle, nextWeekly } from '../cycles/cutoff';

/** Produce is delivered on the Tuesday and Friday routes. */
export const PRODUCE_ROUTE_DOWS = [2, 5] as const;
/** Route days are planned 07:00 SAST; the cut-off is 48 hours before that. */
const ROUTE_HOUR = 7;
const ROUTE_MINUTE = 0;

export interface ProduceCycle extends Cycle {
  id: string;
  routeDay: Date;
  /** True when a public order may still be placed. */
  orderOpen: boolean;
}

/** Deterministic id: one produce cycle per route day. */
export function produceCycleId(routeDay: Date): string {
  return `produce:${routeDay.toISOString()}`;
}

/** The next `count` route days strictly after `now`, in ascending order. */
export function produceRouteDays(now: Date, count: number, dows: readonly number[] = PRODUCE_ROUTE_DOWS): Date[] {
  const days: Date[] = [];
  let cursor = now;
  for (let i = 0; i < count * dows.length && days.length < count; i++) {
    const next = dows
      .map((dow) => nextWeekly(cursor, dow, ROUTE_HOUR, ROUTE_MINUTE))
      .sort((a, b) => a.getTime() - b.getTime())[0];
    days.push(next);
    cursor = next;
  }
  return days;
}

/** The upcoming produce cycles, each with its open/closed state at `now`. */
export function produceCycles(now: Date, count = 4, dows: readonly number[] = PRODUCE_ROUTE_DOWS): ProduceCycle[] {
  return produceRouteDays(now, count, dows).map((routeDay) => {
    const cycle = eggsDairyProduceCycle(routeDay);
    return {
      ...cycle,
      id: produceCycleId(routeDay),
      routeDay,
      orderOpen: now.getTime() < cycle.cutoffAt.getTime(),
    };
  });
}

/** The soonest produce cycle that a public order can still join, or null. */
export function nextOpenProduceCycle(
  now: Date,
  count = 4,
  dows: readonly number[] = PRODUCE_ROUTE_DOWS,
): ProduceCycle | null {
  return produceCycles(now, count, dows).find((c) => c.orderOpen) ?? null;
}
