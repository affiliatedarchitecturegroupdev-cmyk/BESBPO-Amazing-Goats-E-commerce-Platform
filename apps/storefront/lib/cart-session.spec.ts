import { describe, it, expect } from 'vitest';
import { DEFAULT_DELIVERY_FEE_CENTS, DEFAULT_ZONE_ID, parseCart } from './cart-session';
import { FIXTURE_CART_LINES } from './fixtures';

describe('parseCart', () => {
  it('falls back to the fixture cart when there is no cookie', () => {
    const cart = parseCart(undefined);
    expect(cart.lines).toEqual(FIXTURE_CART_LINES);
    expect(cart.deliveryFeeCents).toBe(DEFAULT_DELIVERY_FEE_CENTS);
    expect(cart.zoneId).toBe(DEFAULT_ZONE_ID);
  });

  it('reads lines from the cart cookie and drops malformed ones', () => {
    const cookie = encodeURIComponent(
      JSON.stringify({
        lines: [
          { sku: 'AG-LM-001', name: 'Full lamb box', qty: 2, unitPriceExVatCents: 189900, fulfilment: 'pre_order_cycle', temperature: 'chilled' },
          { sku: 'broken' },
        ],
        deliveryFeeCents: 0,
        zoneId: '3',
      }),
    );
    const cart = parseCart(cookie);
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0].sku).toBe('AG-LM-001');
    expect(cart.deliveryFeeCents).toBe(0);
    expect(cart.zoneId).toBe('3');
  });

  it('falls back to the fixture cart on malformed JSON', () => {
    expect(parseCart('not-json').lines).toEqual(FIXTURE_CART_LINES);
  });
});
