import { describe, it, expect } from 'vitest';
import { applyFee, estimateFeeCents, feeEntry, unquotedFeeModels } from './provider-fees';

describe('applyFee', () => {
  it('applies the percentage and fixed part', () => {
    expect(applyFee({ percent: 3.2, fixedCents: 200 }, 310500)).toBe(10136);
    expect(applyFee({ percent: 2.95 }, 310500)).toBe(9160);
  });

  it('respects the floor', () => {
    expect(applyFee({ percent: 2, minCents: 200 }, 1000)).toBe(200);
    expect(applyFee({ percent: 2, minCents: 200 }, 50000)).toBe(1000);
  });
});

describe('estimateFeeCents', () => {
  it('matches the published figures on a R3,105 box', () => {
    expect(estimateFeeCents('payfast', 'card', 310500)).toBe(10136);
    expect(estimateFeeCents('peach', 'card', 310500)).toBe(9310);
    expect(estimateFeeCents('stitch', 'card', 310500)).toBe(9160);
    expect(estimateFeeCents('payfast', 'pay_by_bank', 310500)).toBe(6210);
    expect(estimateFeeCents('peach', 'pay_by_bank', 310500)).toBe(4808);
  });

  it('applies the escrow minimum fee', () => {
    expect(estimateFeeCents('tradesafe', 'escrow', 1_000_000)).toBe(15000);
    expect(estimateFeeCents('tradesafe', 'escrow', 1_000_000_000)).toBe(15000000);
  });

  it('throws for a provider and method with no recorded model', () => {
    expect(() => estimateFeeCents('lulapay', 'trade_bnpl', 500000)).toThrow(/No fee model/);
  });
});

describe('the schedule is reviewable', () => {
  it('names the source of every entry', () => {
    expect(feeEntry('peach', 'card')?.source).toBeTruthy();
  });

  it('lists every rate a human still has to confirm in writing (T-031)', () => {
    expect(unquotedFeeModels()).toEqual([
      'payfast/card',
      'payfast/pay_by_bank',
      'peach/card',
      'peach/pay_by_bank',
      'stitch/card',
      'tradesafe/escrow',
    ]);
  });
});
