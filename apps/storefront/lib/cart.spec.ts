import { describe, it, expect } from 'vitest';
import {
  addLine,
  cartCount,
  cartTotals,
  hasReservation,
  removeLine,
  safeBack,
  setLineQty,
  toCartLine,
  toOrderLines,
  type CartLine,
} from './cart';

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

describe('addLine', () => {
  it('appends a new line', () => {
    const lines = addLine([], line({ qty: 2 }));
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(2);
  });

  it('merges into an existing line for the same SKU', () => {
    const lines = addLine([line({ qty: 1 })], line({ qty: 2, name: 'ignored' }));
    expect(lines).toHaveLength(1);
    expect(lines[0].qty).toBe(3);
    expect(lines[0].name).toBe('Full lamb box');
  });

  it('ignores a non-positive quantity', () => {
    expect(addLine([], line({ qty: 0 }))).toEqual([]);
  });

  it('clamps a fractional quantity to whole units', () => {
    expect(addLine([], line({ qty: 1.9 }))[0].qty).toBe(1);
  });
});

describe('setLineQty', () => {
  it('sets a whole quantity', () => {
    expect(setLineQty([line()], 'AG-LM-001', 3)[0].qty).toBe(3);
  });

  it('removes the line when the quantity reaches zero', () => {
    expect(setLineQty([line()], 'AG-LM-001', 0)).toEqual([]);
  });
});

describe('removeLine', () => {
  it('drops the matching line and leaves the rest', () => {
    const lines = removeLine([line({ sku: 'a' }), line({ sku: 'b' })], 'a');
    expect(lines.map((l) => l.sku)).toEqual(['b']);
  });
});

describe('cartCount', () => {
  it('sums whole units', () => {
    expect(cartCount([line({ qty: 2 }), line({ sku: 'b', qty: 3 })])).toBe(5);
  });
});

describe('toCartLine', () => {
  const item = { sku: 'AG-EG-001', name: 'Eggs tray', fulfilment: 'in_stock' as const, temperature: 'ambient' as const, priceCents: 8500 };

  it('maps a priced item to a cart line', () => {
    expect(toCartLine(item, 2)).toEqual({
      sku: 'AG-EG-001', name: 'Eggs tray', qty: 2, unitPriceExVatCents: 8500,
      fulfilment: 'in_stock', temperature: 'ambient',
    });
  });

  it('returns null for an item with no price', () => {
    expect(toCartLine({ ...item, priceCents: undefined })).toBeNull();
  });

  it('returns null for a non-positive quantity', () => {
    expect(toCartLine(item, 0)).toBeNull();
  });
});

describe('safeBack', () => {
  it('keeps an internal path', () => {
    expect(safeBack('/product/lamb')).toBe('/product/lamb');
  });

  it('falls back to the cart for an external or protocol-relative path', () => {
    expect(safeBack('https://evil.example')).toBe('/cart');
    expect(safeBack('//evil.example')).toBe('/cart');
    expect(safeBack('')).toBe('/cart');
  });
});
