import { cookies } from 'next/headers';
import type { Cart, CartLine } from './cart';

/**
 * The shopper's cart as a server-readable cookie. The storefront owns the cart
 * until the gateway issues a cart session, so `writeCart` is called from the
 * cart server actions. Nothing here is a secret, but the cookie is httpOnly and
 * read on the server only.
 */
export const CART_COOKIE = 'ag_cart';

/** Default delivery fee for zone 2, used until the gateway prices the zone. */
export const DEFAULT_DELIVERY_FEE_CENTS = 6500;
export const DEFAULT_ZONE_ID = 2;

/** An empty cart, with the delivery defaults the checkout reads. */
export function emptyCart(): Cart {
  return { lines: [], deliveryFeeCents: DEFAULT_DELIVERY_FEE_CENTS, zoneId: DEFAULT_ZONE_ID };
}

function isLine(l: unknown): l is CartLine {
  return (
    typeof l === 'object' &&
    l !== null &&
    typeof (l as CartLine).sku === 'string' &&
    typeof (l as CartLine).qty === 'number' &&
    typeof (l as CartLine).unitPriceExVatCents === 'number'
  );
}

/** Read a cart cookie. A missing or malformed cookie is an empty cart. */
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
      // fall through to the empty cart
    }
  }
  return emptyCart();
}

/** The cart cookie value: the lines and the delivery defaults. */
export function serializeCart(cart: Cart): string {
  return encodeURIComponent(
    JSON.stringify({
      lines: cart.lines,
      deliveryFeeCents: cart.deliveryFeeCents,
      zoneId: cart.zoneId,
      paymentMethod: cart.paymentMethod,
    }),
  );
}

export function cartSession(): Cart {
  return parseCart(cookies().get(CART_COOKIE)?.value);
}

/** Persist the cart. Only call this from a server action or a route handler. */
export function writeCart(cart: Cart): void {
  cookies().set(CART_COOKIE, serializeCart(cart), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

