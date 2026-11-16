import type { CycleRecord } from '../cycles/cycle-engine';

/** How often a subscription recurs. */
export const CADENCES = ['weekly', 'fortnightly', 'monthly'] as const;
export type Cadence = (typeof CADENCES)[number];

/**
 * A recurring order. `nextRunAt` is the instant the next order is placed; it is
 * always advanced by exactly one cadence, so a skip never jumps the schedule.
 */
export interface Subscription {
  id: string;
  customerUserId: string;
  bundleId: string | null;
  cadence: Cadence;
  /** ISO instant of the next run. */
  nextRunAt: string;
  paused: boolean;
  /** Run instants the customer skipped, kept so the history is auditable. */
  skipped?: string[];
}

/** One line of a standing order; quantity in the variant's unit. */
export interface StandingOrderLine {
  variantId: string;
  qty: number;
}

/**
 * A trade standing order: the same basket delivered on a fixed weekday, until
 * paused (with an optional resume date) or ended.
 */
export interface StandingOrder {
  id: string;
  orgId: string;
  /** Delivery weekday, 0 = Sunday .. 6 = Saturday (SAST). */
  dayOfWeek: number;
  /** Free-text window such as `06:00-10:00`; the start drives the run time. */
  deliveryWindow: string | null;
  /** Resume date `YYYY-MM-DD`; the order is paused while `at` is on or before it. */
  pausedUntil: string | null;
  active: boolean;
  lines: StandingOrderLine[];
}

/** A run that is due, paired with the cycle it would be placed into. */
export interface DueRun<T> {
  schedule: T;
  runAt: string;
  cycle: CycleRecord | null;
}
