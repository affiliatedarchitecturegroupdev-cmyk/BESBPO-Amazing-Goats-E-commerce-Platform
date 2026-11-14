import type { CycleStatus } from '@ag/shared-types';
import type { CycleRecord } from '../cycles/cycle-engine';
import { STANDARD_VAT_RATE, Cart, Order, OrderLine } from './orders.types';

/** Round half-up to whole cents, so the VAT-inclusive total is always exact. */
export function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON);
}

/**
 * Assign a cycle to an order placed at `placedAt`. Cycle-required lines take the
 * soonest cycle still open at that instant; a cycle whose cut-off has passed is
 * skipped, so late orders roll to the next one. Null when none is open.
 */
export function assignCycle(
  lines: { fulfilment: string }[],
  cycles: CycleRecord[],
  placedAt: Date,
): CycleRecord | null {
  const needsCycle = lines.some((l) => l.fulfilment === 'pre_order_cycle' || l.fulfilment === 'seasonal_pre_order');
  if (!needsCycle) return null;
  const now = placedAt.getTime();
  const open = cycles
    .filter((c) => Date.parse(c.cutoffAt) > now && isOpenStatus(c.status))
    .sort((a, b) => a.cutoffAt.localeCompare(b.cutoffAt));
  return open[0] ?? null;
}

/** A cycle already closed or fulfilled can never take a new order. */
function isOpenStatus(status: CycleStatus): boolean {
  return status === 'scheduled' || status === 'open';
}

/** Cart lines to order lines; quantities are clamped to whole units, price is per unit. */
export function toOrderLines(cart: Cart): OrderLine[] {
  return cart.lines
    .filter((l) => l.qty > 0)
    .map((l) => ({
      sku: l.sku,
      qty: l.qty,
      unitPriceExVatCents: l.unitPriceExVatCents,
      fulfilment: l.fulfilment,
      temperature: l.temperature,
    }));
}

export interface BuildOrderOptions {
  id: string;
  placedAt: Date;
  cycles?: CycleRecord[];
  vatRate?: number;
}

/**
 * Build an order from a cart: keep each line's fulfilment type, assign the cycle
 * for cycle-required lines, and total the money (VAT on goods, not on delivery).
 * A cycle-required cart with no open cycle is refused so the caller can tell the
 * customer to try the next cycle.
 */
export function buildOrder(cart: Cart, options: BuildOrderOptions): Order {
  const lines = toOrderLines(cart);
  if (lines.length === 0) throw new Error('cart is empty');

  const cycle = assignCycle(lines, options.cycles ?? [], options.placedAt);
  const needsCycle = lines.some((l) => l.fulfilment === 'pre_order_cycle' || l.fulfilment === 'seasonal_pre_order');
  if (needsCycle && !cycle) throw new Error('no open cycle for this order');

  const subtotalExVatCents = lines.reduce((sum, l) => sum + roundCents(l.unitPriceExVatCents * l.qty), 0);
  const deliveryFeeCents = Math.max(0, cart.deliveryFeeCents ?? 0);
  const vatRate = options.vatRate ?? STANDARD_VAT_RATE;
  const vatCents = roundCents(subtotalExVatCents * vatRate);
  const totalIncVatCents = subtotalExVatCents + vatCents + deliveryFeeCents;

  return {
    id: options.id,
    cycleId: cycle?.id ?? null,
    status: 'pending_payment',
    lines,
    subtotalExVatCents,
    deliveryFeeCents,
    vatCents,
    totalIncVatCents,
    ...(cart.paymentMethod ? { paymentMethod: cart.paymentMethod } : {}),
    ...(cart.deliveryAddress ? { deliveryAddress: cart.deliveryAddress } : {}),
    createdAt: options.placedAt.toISOString(),
  };
}
