import { cookies } from 'next/headers';
import type { Cart, CartLine } from './cart';
import { FIXTURE_CART_LINES } from './fixtures';

/**
 * The shopper's cart as a server-readable cookie. The full cart is held in the
 * cart cookie the gateway sets; until that cookie is issued we fall back to the
 * fixture lines so the cart and checkout screens render. Nothing here is a
 * secret, so the cookie is readable on the server only (no `NEXT_PUBLIC_`).
 */
export const CART_COOKIE = 'ag_cart';

/** Default delivery fee for zone 2, used until the gateway prices the zone. */
export const DEFAULT_DELIVERY_FEE_CENTS = 6500;
export const DEFAULT_ZONE_ID = 2;

function isLine(l: unknown): l is CartLine {
  return (
    typeof l === 'object' &&
    l !== null &&
    typeof (l as CartLine).sku === 'string' &&
    typeof (l as CartLine).qty === 'number' &&
    typeof (l as CartLine).unitPriceExVatCents === 'number'
  );
}

export function parseCart(raw: string | undefined): Cart {
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw)) as Partial<Cart>;
      if (Array.isArray(parsed.lines)) {
        return {
          lines: parsed.lines.filter(isLine),
          deliveryFeeCents: parsed.deliveryFeeCents ?? DEFAULT_DELIVERY_FEE_CENTS,
          zoneId: parsed.zoneId ?? DEFAULT_ZONE_ID,
          paymentMethod: parsed.paymentMethod,
        };
      }
    } catch {
      // fall through to the fixture cart
    }
  }
  return { lines: FIXTURE_CART_LINES, deliveryFeeCents: DEFAULT_DELIVERY_FEE_CENTS, zoneId: DEFAULT_ZONE_ID };
}

export function cartSession(): Cart {
  return parseCart(cookies().get(CART_COOKIE)?.value);
}

