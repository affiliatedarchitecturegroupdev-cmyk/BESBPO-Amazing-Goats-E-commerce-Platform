import { describe, it, expect } from 'vitest';
import { cartTotals, hasReservation, toOrderLines, type CartLine } from './cart';

const line = (over: Partial<CartLine> = {}): CartLine => ({
  sku: 'AG-LM-001', name: 'Full lamb box', qty: 1, unitPriceExVatCents: 10000,
  fulfilment: 'pre_order_cycle', temperature: 'chilled', ...over,
});

describe('toOrderLines', () => {
  it('drops empty lines and clamps quantities to whole units', () => {
    const lines = toOrderLines([line({ qty: 2 }), line({ qty: 0 }), line({ qty: 1.9 })]);
    expect(lines.map((l) => l.qty)).toEqual([2, 1]);
  });
});

describe('cartTotals', () => {
  it('charges VAT on goods but never on the delivery fee', () => {
    const totals = cartTotals({ lines: [line({ qty: 2, unitPriceExVatCents: 10000 })], deliveryFeeCents: 6500 });
    expect(totals.subtotalExVatCents).toBe(20000);
    expect(totals.vatCents).toBe(3000);
    expect(totals.totalIncVatCents).toBe(29500);
  });

  it('treats a missing or negative delivery fee as zero', () => {
    expect(cartTotals({ lines: [line()] }).deliveryFeeCents).toBe(0);
    expect(cartTotals({ lines: [line()], deliveryFeeCents: -500 }).deliveryFeeCents).toBe(0);
  });

  it('uses the supplied VAT rate', () => {
    expect(cartTotals({ lines: [line()] }, 0.2).vatCents).toBe(2000);
  });
});

describe('hasReservation', () => {
  it('is true for live goods and reservations', () => {
    expect(hasReservation([line({ temperature: 'live' })])).toBe(true);
    expect(hasReservation([line({ fulfilment: 'reservation' })])).toBe(true);
    expect(hasReservation([line()])).toBe(false);
  });
});
