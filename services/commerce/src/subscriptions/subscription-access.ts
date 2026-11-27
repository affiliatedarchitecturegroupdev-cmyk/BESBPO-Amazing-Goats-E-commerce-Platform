import type { Caller } from '../orders/order-access';
import type { Cadence, Subscription } from './subscriptions.types';

/**
 * Whether a caller may see a subscription.
 *
 * Same shape as `canViewOrder`, and for the same reason: the storefront reads by
 * id, and a subscription id that is guessable would let one customer read
 * another's schedule. A staff member with `orders:read` sees any subscription; a
 * customer sees only their own.
 *
 * A subscription with no owner is treated like an unowned order — it belongs to
 * nobody a customer may claim, so only staff can read it. `customerUserId` is
 * empty rather than null in the SQL projection, so both absences are covered.
 */
export type OwnedSubscription = Subscription;

export function canViewSubscription(subscription: OwnedSubscription, caller: Caller): boolean {
  if (caller.staff) return true;
  if (!caller.userId) return false;
  if (!subscription.customerUserId) return false;
  return subscription.customerUserId === caller.userId;
}

/**
 * The customer's view of a subscription: what a shopper needs to recognise the
 * schedule, with the owner id removed. Keeping the projection here means a new
 * field on `Subscription` cannot reach the storefront by default.
 */
export interface PublicSubscription {
  id: string;
  cadence: Cadence;
  nextRunAt: string;
  paused: boolean;
  /** Runs the customer skipped, so the schedule history is explainable. */
  skipped: string[];
}

export function toPublicSubscription(subscription: OwnedSubscription): PublicSubscription {
  return {
    id: subscription.id,
    cadence: subscription.cadence,
    nextRunAt: subscription.nextRunAt,
    paused: subscription.paused,
    skipped: subscription.skipped ?? [],
  };
}
