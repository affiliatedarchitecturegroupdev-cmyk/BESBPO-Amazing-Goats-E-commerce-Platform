/**
 * The collections schedule. The steps and their offsets come from the credit
 * control design (docs/03-credit-control.md): a reminder 3 days before due, the
 * due notice, a reminder at +1, a call at +7, an account hold at +14 (standing
 * orders paused) and a final demand at +30. The step names match the CHECK
 * constraint on `accounts.collection_actions`, so a scheduled row is the plan.
 */
export type DunningStep =
  | 'reminder_pre'
  | 'due_notice'
  | 'reminder_1'
  | 'call_7'
  | 'hold_14'
  | 'demand_30';

/** Days relative to the due date for each step. */
export const DUNNING_OFFSETS: Record<DunningStep, number> = {
  reminder_pre: -3,
  due_notice: 0,
  reminder_1: 1,
  call_7: 7,
  hold_14: 14,
  demand_30: 30,
};

/** At this many days past due the account is put on hold and standing orders pause. */
export const HOLD_STANDING_ORDERS_AT_DAYS = 14;

const MS_PER_DAY = 86_400_000;

export interface CollectionAction {
  invoiceId: string;
  step: DunningStep;
  scheduledAt: string;
}

/** Raised when a date is not a `YYYY-MM-DD` calendar date. */
export class CollectionsRuleError extends Error {}

/** The due date plus `days`, as `YYYY-MM-DD`. Dates are handled in UTC. */
export function addDays(dueOn: string, days: number): string {
  const base = new Date(`${dueOn}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime())) throw new CollectionsRuleError(`not a date: ${dueOn}`);
  return new Date(base.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `dueOn` to `asOf`; negative before the due date, zero on it. */
export function daysPastDue(dueOn: string, asOf: string): number {
  const due = new Date(`${dueOn}T00:00:00.000Z`).getTime();
  const now = new Date(`${asOf}T00:00:00.000Z`).getTime();
  if (Number.isNaN(due) || Number.isNaN(now)) throw new CollectionsRuleError('not a date');
  return Math.round((now - due) / MS_PER_DAY);
}

/** The full dunning plan for an invoice, one action per step, in date order. */
export function dunningSchedule(invoiceId: string, dueOn: string): CollectionAction[] {
  return (Object.keys(DUNNING_OFFSETS) as DunningStep[])
    .map((step) => ({ invoiceId, step, scheduledAt: addDays(dueOn, DUNNING_OFFSETS[step]) }))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

/** The steps whose scheduled date has arrived by `asOf`, for a worker to run. */
export function dueActions<T extends CollectionAction>(actions: readonly T[], asOf: string): T[] {
  return actions.filter((a) => a.scheduledAt <= asOf);
}

export type AgeingBucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

/** The ageing bucket a statement groups an overdue invoice into. */
export function ageingBucket(daysOverdue: number): AgeingBucket {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

/**
 * Whether the account goes on hold. At 14 days past due the standing orders
 * pause, so the customer cannot run up more debt while an invoice is unpaid.
 */
export function shouldHoldStandingOrders(daysOverdue: number): boolean {
  return daysOverdue >= HOLD_STANDING_ORDERS_AT_DAYS;
}
