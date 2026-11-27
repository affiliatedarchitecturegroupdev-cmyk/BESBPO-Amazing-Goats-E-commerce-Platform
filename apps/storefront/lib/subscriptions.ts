import type { MySubscription, SubscriptionCadence } from '@ag/api-client';

/**
 * How the account page describes a recurring order (T-056).
 *
 * The page has to answer three questions in words: when does it next run, how
 * often, and is it running at all. Those are rules, so they are pure functions
 * here rather than inline in the component, where they would need a browser to
 * test. Dates are rendered in SAST because a delivery day means a South African
 * calendar day: a run at 22:00 UTC is the next morning in Durban, and showing
 * the UTC date would name the wrong day.
 */

const SAST_OFFSET_MS = 2 * 3600 * 1000;

const CADENCE_WORDS: Record<SubscriptionCadence, string> = {
  weekly: 'Every week',
  fortnightly: 'Every two weeks',
  monthly: 'Every month',
};

/** `weekly` -> "Every week". */
export function cadenceLabel(cadence: SubscriptionCadence): string {
  return CADENCE_WORDS[cadence];
}

/** The SAST calendar day of an instant, as `2026-11-29`. */
export function sastDay(iso: string): string {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return '';
  return new Date(at.getTime() + SAST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * The next run as a sentence. A paused subscription still has a `nextRunAt`
 * (pausing is not skipping), so the date is shown with the pause stated rather
 * than hidden — the customer needs to know what resumes.
 */
export function nextRunLabel(subscription: Pick<MySubscription, 'nextRunAt' | 'paused'>, today?: string): string {
  const day = sastDay(subscription.nextRunAt);
  if (!day) return 'No date set';
  if (subscription.paused) return `Paused · next run ${day} when resumed`;
  const current = today ?? sastDay(new Date().toISOString());
  if (day === current) return 'Runs today';
  return `Next run ${day}`;
}

/** A one-word state for the badge. */
export function subscriptionState(subscription: Pick<MySubscription, 'paused'>): 'Active' | 'Paused' {
  return subscription.paused ? 'Paused' : 'Active';
}

/**
 * Subscriptions in the order the page shows them: running ones first, then by
 * next run. A paused subscription is not "sooner" just because its stale
 * `nextRunAt` is in the past, so it must not sort to the top of the list.
 */
export function sortForAccount(subscriptions: MySubscription[]): MySubscription[] {
  return [...subscriptions].sort((a, b) => {
    if (a.paused !== b.paused) return a.paused ? 1 : -1;
    return a.nextRunAt.localeCompare(b.nextRunAt);
  });
}
