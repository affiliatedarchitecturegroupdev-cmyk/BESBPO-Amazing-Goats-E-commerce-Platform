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
  /** Delivery zone id; the gateway may carry it as a string or a number. */
  zoneId?: number | string;
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

/** Quantities are whole units and never negative. */
function clampQty(qty: number): number {
  return Math.max(0, Math.floor(Number.isFinite(qty) ? qty : 0));
}

/**
 * Add a line, merging it into an existing line for the same SKU so a product
 * added twice is one line with the summed quantity. The stored price is the
 * one already on the line, so a second add cannot reprice it.
 */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const qty = clampQty(line.qty);
  if (qty <= 0) return lines;
  const existing = lines.find((l) => l.sku === line.sku);
  if (!existing) return [...lines, { ...line, qty }];
  return lines.map((l) => (l.sku === line.sku ? { ...l, qty: clampQty(l.qty + qty) } : l));
}

/** Set a line's quantity; a quantity of zero or less removes the line. */
export function setLineQty(lines: CartLine[], sku: string, qty: number): CartLine[] {
  const next = clampQty(qty);
  if (next <= 0) return removeLine(lines, sku);
  return lines.map((l) => (l.sku === sku ? { ...l, qty: next } : l));
}

/** Remove a line. */
export function removeLine(lines: CartLine[], sku: string): CartLine[] {
  return lines.filter((l) => l.sku !== sku);
}

/** How many units are in the cart, for the header badge. */
export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + clampQty(l.qty), 0);
}

/** The catalogue fields a cart line needs; a `StorefrontItem` satisfies it. */
export interface PricedItem {
  sku: string;
  name: string;
  fulfilment: FulfilmentType;
  temperature: Temperature;
  priceCents?: number;
}

/**
 * A cart line from a catalogue item, or null when the item carries no price: a
 * quote-only line cannot go into a self-service cart. The catalogue price is
 * ex-VAT, matching `unitPriceExVatCents`.
 */
export function toCartLine(item: PricedItem, qty = 1): CartLine | null {
  const units = clampQty(qty);
  if (item.priceCents == null || units <= 0) return null;
  return {
    sku: item.sku,
    name: item.name,
    qty: units,
    unitPriceExVatCents: item.priceCents,
    fulfilment: item.fulfilment,
    temperature: item.temperature,
  };
}

/** The cart is the fallback destination for a cart action. */
export const CART_PATH = '/cart';

/**
 * Where to send the shopper back to after a cart action. Only an internal path
 * is allowed, so a tampered form cannot turn the redirect into an open redirect.
 */
export function safeBack(raw: string): string {
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : CART_PATH;
}
