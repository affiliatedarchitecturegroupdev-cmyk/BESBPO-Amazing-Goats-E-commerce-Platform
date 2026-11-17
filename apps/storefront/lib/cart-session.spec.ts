import { describe, it, expect } from 'vitest';
import {
  DEFAULT_DELIVERY_FEE_CENTS,
  DEFAULT_ZONE_ID,
  emptyCart,
  parseCart,
  serializeCart,
} from './cart-session';

describe('parseCart', () => {
  it('is an empty cart when there is no cookie', () => {
    const cart = parseCart(undefined);
    expect(cart.lines).toEqual([]);
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

  it('is an empty cart on malformed JSON', () => {
    expect(parseCart('not-json').lines).toEqual([]);
  });
});

describe('serializeCart', () => {
  it('round-trips through parseCart', () => {
    const cart = {
      lines: [{ sku: 'AG-EG-001', name: 'Eggs tray', qty: 2, unitPriceExVatCents: 8500, fulfilment: 'in_stock' as const, temperature: 'ambient' as const }],
      deliveryFeeCents: 0,
      zoneId: 1,
    };
    expect(parseCart(serializeCart(cart))).toEqual(cart);
  });
});

describe('emptyCart', () => {
  it('has no lines and the delivery defaults', () => {
    expect(emptyCart()).toEqual({ lines: [], deliveryFeeCents: DEFAULT_DELIVERY_FEE_CENTS, zoneId: DEFAULT_ZONE_ID });
  });
});
