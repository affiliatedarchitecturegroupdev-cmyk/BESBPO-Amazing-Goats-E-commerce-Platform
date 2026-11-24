import type { OrderStatus } from '@ag/shared-types';

/**
 * The tracking page's decisions, as pure functions (T-077 `sf-track`).
 *
 * The wireframe asks for four chips, an ETA and a thank-you offer. What the page
 * may honestly show depends on the order's status, and that mapping is a rule,
 * so it is tested here rather than being written inline in the component where
 * it would need a browser to test.
 */

/** The steps a delivered order passes through, in wireframe order. */
export const TRACK_STEPS = ['confirmed', 'packing', 'out_for_delivery', 'delivered'] as const;
export type TrackStep = (typeof TRACK_STEPS)[number];

export interface TimelineStep {
  step: TrackStep;
  label: string;
  state: 'done' | 'active' | 'pending';
}

const LABELS: Record<TrackStep, string> = {
  confirmed: 'Confirmed',
  packing: 'Packing',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

/**
 * Where each status sits on the timeline. `pending_payment` is before the first
 * step: the order exists but is not confirmed, so nothing is ticked and the page
 * says payment is the next action instead of showing a "confirmed" the shop has
 * not agreed to. `in_cycle` shares "confirmed": the order is scheduled, which is
 * what confirmed means to a shopper.
 */
const STEP_INDEX: Record<OrderStatus, number | null> = {
  pending_payment: null,
  confirmed: 0,
  in_cycle: 0,
  packing: 1,
  out_for_delivery: 2,
  delivered: 3,
  cancelled: null,
  refunded: null,
};

const TERMINAL: readonly OrderStatus[] = ['cancelled', 'refunded'];

export interface OrderTimeline {
  steps: TimelineStep[];
  /** True when the order will not progress further. */
  terminal: boolean;
  /** True once delivered, so the page stops promising a slot. */
  complete: boolean;
  /** What happens next, in plain language; null when there is nothing to do. */
  nextAction: string | null;
}

/**
 * The timeline for a status. A terminal order has no steps: showing four grey
 * chips would suggest the parcel is still coming. An unrecognised status yields
 * all-pending rather than throwing, because a tracking page that errors tells
 * the customer less than one that shows the order summary.
 */
export function orderTimeline(status: OrderStatus): OrderTimeline {
  if (TERMINAL.includes(status)) {
    return {
      steps: [],
      terminal: true,
      complete: false,
      nextAction: status === 'cancelled' ? 'This order was cancelled.' : 'This order was refunded.',
    };
  }

  const index = STEP_INDEX[status] ?? null;

  if (index === null) {
    return {
      steps: TRACK_STEPS.map((step) => ({ step, label: LABELS[step], state: 'pending' as const })),
      terminal: false,
      complete: false,
      nextAction: 'We will confirm your order once payment clears.',
    };
  }

  const atEnd = index === TRACK_STEPS.length - 1;
  return {
    steps: TRACK_STEPS.map((step, i) => ({
      step,
      label: LABELS[step],
      state: i < index ? 'done' : i === index ? 'active' : 'pending',
    })),
    terminal: false,
    complete: atEnd,
    nextAction: atEnd
      ? null
      : index === 1
        ? 'We are packing your order for the next delivery run.'
        : index === 2
          ? 'Your driver is on the way.'
          : 'We will pack your order for the next delivery run.',
  };
}

/**
 * A stable, human-readable reference for an order. Order ids are `ord_<epoch>`,
 * which is long and not something a customer would read down a phone. The last
 * six characters are the useful part and are what the page shows.
 */
export function orderReference(id: string): string {
  const digits = id.replace(/\D/g, '');
  return digits.length >= 6 ? digits.slice(-6) : id;
}
