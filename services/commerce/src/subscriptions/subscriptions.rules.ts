import type { CycleRecord } from '../cycles/cycle-engine';
import { Cadence, DueRun, StandingOrder, Subscription } from './subscriptions.types';

/** Raised when a subscription or standing-order transition is not allowed. */
export class SubscriptionError extends Error {}

const DAY_MS = 24 * 3600 * 1000;
const SAST_MS = 2 * 3600 * 1000;

/** Days a cadence adds between runs. `monthly` is handled by calendar, not days. */
function cadenceDays(cadence: Cadence): number | null {
  if (cadence === 'weekly') return 7;
  if (cadence === 'fortnightly') return 14;
  return null;
}

/** Add one cadence to an instant. `monthly` keeps the same day of month where possible. */
export function nextRunAt(cadence: Cadence, from: Date): Date {
  const days = cadenceDays(cadence);
  if (days != null) return new Date(from.getTime() + days * DAY_MS);
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const next = new Date(Date.UTC(y, m + 1, d, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds()));
  // A month with fewer days rolls back to its last day rather than skipping a month.
  if (next.getUTCDate() !== d) return new Date(Date.UTC(y, m + 2, 0, from.getUTCHours(), from.getUTCMinutes(), from.getUTCSeconds()));
  return next;
}

/** Is the subscription due to run at `at`? Paused subscriptions are never due. */
export function isSubscriptionDue(subscription: Subscription, at: Date): boolean {
  if (subscription.paused) return false;
  return Date.parse(subscription.nextRunAt) <= at.getTime();
}

/** The soonest still-open cycle, or null. The cut-off engine owns what "open" means. */
export function openCycleFor(cycles: CycleRecord[], at: Date): CycleRecord | null {
  const open = cycles
    .filter((c) => Date.parse(c.cutoffAt) > at.getTime() && (c.status === 'scheduled' || c.status === 'open'))
    .sort((a, b) => a.cutoffAt.localeCompare(b.cutoffAt));
  return open[0] ?? null;
}

/**
 * Advance a subscription by exactly one cadence, recording the skipped run when
 * the customer skipped it. The cadence never jumps to the next cut-off, so the
 * schedule the customer chose is preserved; the run is matched to a cycle when
 * it is actually placed.
 */
export function advance(subscription: Subscription, at: Date, skipped: boolean): Subscription {
  const next = nextRunAt(subscription.cadence, new Date(subscription.nextRunAt));
  return {
    ...subscription,
    nextRunAt: next.toISOString(),
    ...(skipped ? { skipped: [...(subscription.skipped ?? []), subscription.nextRunAt] } : {}),
  };
}

export function pause(subscription: Subscription): Subscription {
  return { ...subscription, paused: true };
}

export function resume(subscription: Subscription): Subscription {
  return { ...subscription, paused: false };
}

/** Every subscription due at `at`, each paired with the cycle it would land in. */
export function dueSubscriptions(
  subscriptions: Subscription[],
  cycles: CycleRecord[],
  at: Date,
): DueRun<Subscription>[] {
  return subscriptions
    .filter((s) => isSubscriptionDue(s, at))
    .map((s) => ({ schedule: s, runAt: s.nextRunAt, cycle: openCycleFor(cycles, at) }));
}

/** The local (SAST) weekday and minutes-past-midnight for an instant. */
function sastParts(at: Date): { dow: number; minutes: number } {
  const z = new Date(at.getTime() + SAST_MS);
  return { dow: z.getUTCDay(), minutes: z.getUTCHours() * 60 + z.getUTCMinutes() };
}

/** Parse `06:00-10:00` to its start in minutes; default 06:00. */
function windowStartMinutes(window: string | null): number {
  if (!window) return 6 * 60;
  const match = /^(\d{1,2}):(\d{2})/.exec(window.trim());
  if (!match) return 6 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** The next instant the standing order is due, respecting the weekday and pause. */
export function nextStandingRun(standing: StandingOrder, from: Date): Date | null {
  if (!standing.active) return null;
  const start = windowStartMinutes(standing.deliveryWindow);
  const z = new Date(from.getTime() + SAST_MS);
  for (let i = 0; i <= 14; i++) {
    const day = new Date(Date.UTC(z.getUTCFullYear(), z.getUTCMonth(), z.getUTCDate() + i));
    if (day.getUTCDay() !== standing.dayOfWeek) continue;
    const candidate = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), 0, 0) + start * 60 * 1000 - SAST_MS);
    if (candidate.getTime() <= from.getTime()) continue;
    if (standing.pausedUntil && candidate.toISOString().slice(0, 10) <= standing.pausedUntil) continue;
    return candidate;
  }
  return null;
}

/** Is the standing order due at `at`? Paused, ended or future orders are not. */
export function isStandingOrderDue(standing: StandingOrder, at: Date): boolean {
  if (!standing.active) return false;
  const { dow, minutes } = sastParts(at);
  if (dow !== standing.dayOfWeek) return false;
  if (minutes < windowStartMinutes(standing.deliveryWindow)) return false;
  if (standing.pausedUntil && at.toISOString().slice(0, 10) <= standing.pausedUntil) return false;
  return true;
}

/** Every standing order due at `at`, each paired with the cycle it would land in. */
export function dueStandingOrders(
  standingOrders: StandingOrder[],
  cycles: CycleRecord[],
  at: Date,
): DueRun<StandingOrder>[] {
  return standingOrders
    .filter((s) => isStandingOrderDue(s, at))
    .map((s) => ({ schedule: s, runAt: at.toISOString(), cycle: openCycleFor(cycles, at) }));
}

export function assertValidStandingOrder(standing: StandingOrder): void {
  if (!Number.isInteger(standing.dayOfWeek) || standing.dayOfWeek < 0 || standing.dayOfWeek > 6) {
    throw new SubscriptionError('dayOfWeek must be 0 (Sunday) to 6 (Saturday)');
  }
  if (standing.lines.length === 0) throw new SubscriptionError('a standing order needs at least one line');
  for (const line of standing.lines) {
    if (!(line.qty > 0)) throw new SubscriptionError(`line for ${line.variantId} needs a positive quantity`);
  }
}
