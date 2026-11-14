import type { FulfilmentType, Temperature } from '@ag/shared-types';
import { roundCents, STANDARD_VAT_RATE } from './tax';

/** A line in the cart, as the storefront holds it. */
export interface CartLine {
  sku: string;
  name: string;
  qty: number;
  unitPriceExVatCents: number;
  fulfilment: FulfilmentType;
  temperature: Temperature;
}

export interface Cart {
  lines: CartLine[];
  deliveryFeeCents?: number;
  zoneId?: number;
  paymentMethod?: string;
}

export interface CartTotals {
  subtotalExVatCents: number;
  deliveryFeeCents: number;
  vatCents: number;
  totalIncVatCents: number;
}

/** Cart lines to order lines, dropping empty quantities and clamping to whole units. */
export function toOrderLines(lines: CartLine[]) {
  return lines
    .filter((l) => l.qty > 0)
    .map((l) => ({
      sku: l.sku,
      qty: Math.floor(l.qty),
      unitPriceExVatCents: l.unitPriceExVatCents,
      fulfilment: l.fulfilment,
      temperature: l.temperature,
    }));
}

/** Totals the cart: VAT on goods only, never on the delivery fee. */
export function cartTotals(cart: Cart, vatRate: number = STANDARD_VAT_RATE): CartTotals {
  const lines = toOrderLines(cart.lines);
  const subtotalExVatCents = lines.reduce((sum, l) => sum + roundCents(l.unitPriceExVatCents * l.qty), 0);
  const deliveryFeeCents = Math.max(0, cart.deliveryFeeCents ?? 0);
  const vatCents = roundCents(subtotalExVatCents * vatRate);
  return { subtotalExVatCents, deliveryFeeCents, vatCents, totalIncVatCents: subtotalExVatCents + vatCents + deliveryFeeCents };
}

/** Does the cart hold a live-animal reservation, which is paid as a deposit? */
export function hasReservation(lines: CartLine[]): boolean {
  return lines.some((l) => l.temperature === 'live' || l.fulfilment === 'reservation');
}
