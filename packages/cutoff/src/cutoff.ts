// Cut-off cycle engine. Africa/Johannesburg is UTC+2 all year (no daylight saving), so fixed-offset maths is safe.
export type ProductClass = 'chilled_meat' | 'eggs_dairy_produce' | 'ambient';
export type Channel = 'public' | 'trade';
const HOUR = 3600 * 1000;
const SAST_MS = 2 * HOUR;

export interface Cycle {
  productClass: ProductClass;
  cutoffAt: Date;          // public orders close
  tradeLockAt?: Date;      // trade standing orders lock
  topUpUntil?: Date;       // trade top-up window (subject to stock and a fee)
  slaughterOn?: Date;
  deliveryFrom: Date;
  deliveryTo: Date;
}

/** Next weekly occurrence strictly after `now` of dow (0=Sunday) at hour:minute SAST. */
export function nextWeekly(now: Date, dow: number, hour: number, minute: number): Date {
  const z = new Date(now.getTime() + SAST_MS);
  for (let i = 0; i <= 7; i++) {
    const d = new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate() + i));
    if (d.getUTCDay() !== dow) continue;
    const candidate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, minute) - SAST_MS);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  throw new Error('unreachable');
}

/** Chilled meat: public cut-off Sunday 17:00, trade lock Sunday 12:00, top-up until Monday 12:00,
 *  slaughter Monday 06:00, delivery Wednesday 06:00 to Friday 18:00. */
export function chilledMeatCycle(now: Date): Cycle {
  const cutoffAt = nextWeekly(now, 0, 17, 0);
  const tradeLockAt = new Date(cutoffAt.getTime() - 5 * HOUR);
  return {
    productClass: 'chilled_meat', cutoffAt, tradeLockAt,
    topUpUntil: new Date(tradeLockAt.getTime() + 24 * HOUR),
    slaughterOn: new Date(cutoffAt.getTime() + 13 * HOUR),
    deliveryFrom: new Date(cutoffAt.getTime() + 61 * HOUR),
    deliveryTo: new Date(cutoffAt.getTime() + 121 * HOUR),
  };
}

/** Eggs, dairy and produce: cut-off 48 hours before the route day. */
export function eggsDairyProduceCycle(routeDay: Date): Cycle {
  return { productClass: 'eggs_dairy_produce', cutoffAt: new Date(routeDay.getTime() - 48 * HOUR), deliveryFrom: routeDay, deliveryTo: new Date(routeDay.getTime() + 12 * HOUR) };
}

/** Ambient goods: next day 15:00 SAST cut-off for same-day packing. */
export function ambientCutoff(now: Date): Date {
  const z = new Date(now.getTime() + SAST_MS);
  const today = new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate(), 15, 0) - SAST_MS);
  return today.getTime() > now.getTime() ? today : new Date(today.getTime() + 24 * HOUR);
}

export function isOrderOpen(cycle: Cycle, now: Date, channel: Channel, topUp = false): boolean {
  if (channel === 'public') return now.getTime() < cycle.cutoffAt.getTime();
  if (topUp && cycle.topUpUntil) return now.getTime() < cycle.topUpUntil.getTime();
  return now.getTime() < (cycle.tradeLockAt ?? cycle.cutoffAt).getTime();
}
