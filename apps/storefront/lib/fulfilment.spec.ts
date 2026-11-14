import { describe, it, expect } from 'vitest';
import { cutoffMessage, earlyWindowMessage, isCycleFulfilment, productClass } from './fulfilment';

describe('productClass', () => {
  it('treats in-stock lines as stocked and the rest as cycle', () => {
    expect(productClass('in_stock')).toBe('stocked');
    expect(productClass('pre_order_cycle')).toBe('cycle');
    expect(productClass('reservation')).toBe('cycle');
  });
});

describe('cutoffMessage', () => {
  it('shows the weekly cut-off for cycle goods and next route day for stock', () => {
    expect(cutoffMessage('cycle')).toBe('Order by Sunday 17:00 for Wednesday delivery');
    expect(cutoffMessage('stocked')).toBe('In stock now, delivered on the next route day');
  });
});

describe('isCycleFulfilment', () => {
  it('is true only for the pre-order types that follow the cut-off', () => {
    expect(isCycleFulfilment('pre_order_cycle')).toBe(true);
    expect(isCycleFulfilment('seasonal_pre_order')).toBe(true);
    expect(isCycleFulfilment('in_stock')).toBe(false);
    expect(isCycleFulfilment('quote')).toBe(false);
  });
});

describe('earlyWindowMessage', () => {
  it('advertises the bakery early window', () => {
    expect(earlyWindowMessage()).toContain('04:00 to 07:00');
    expect(earlyWindowMessage()).toContain('standing orders');
  });
});
