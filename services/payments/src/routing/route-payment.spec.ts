import { describe, it, expect } from 'vitest';
import { routePayment, estimateFeeCents } from './route-payment';

describe('payment routing', () => {
  it('prefers pay-by-bank through Stitch', () => { expect(routePayment({ method: 'pay_by_bank', amountCents: 310500 })[0]).toBe('stitch'); });
  it('uses Peach first for cards with PayFast fallback', () => { expect(routePayment({ method: 'card', amountCents: 310500 }).slice(0, 2)).toEqual(['peach', 'payfast']); });
  it('rejects escrow under R10,000', () => { expect(() => routePayment({ method: 'escrow', amountCents: 500000 })).toThrow(); });
  it('routes escrow to TradeSafe from R10,000', () => { expect(routePayment({ method: 'escrow', amountCents: 1_000_000 })).toEqual(['tradesafe']); });
  it('routes trade terms to LulaPay', () => { expect(routePayment({ method: 'trade_bnpl', amountCents: 500000 })).toEqual(['lulapay']); });
  it('estimates fees on a R3,105 box', () => {
    expect(estimateFeeCents('payfast', 'card', 310500)).toBe(10136);
    expect(estimateFeeCents('peach', 'card', 310500)).toBe(9310);
    expect(estimateFeeCents('stitch', 'card', 310500)).toBe(9160);
    expect(estimateFeeCents('payfast', 'pay_by_bank', 310500)).toBe(6210);
    expect(estimateFeeCents('peach', 'pay_by_bank', 310500)).toBe(4808);
  });
});
