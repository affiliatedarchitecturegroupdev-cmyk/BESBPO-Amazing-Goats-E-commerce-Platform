import { describe, it, expect } from 'vitest';
import { reconcileAll, reconcileSettlement } from './reconciliation.rules';
import { Settlement, SettlementLine } from './reconciliation.types';

const settlement = (over: Partial<Settlement> = {}): Settlement => ({
  id: 'stl_1',
  provider: 'stitch',
  periodStart: '2026-11-10',
  periodEnd: '2026-11-10',
  grossCents: 310_500,
  feesCents: 10_500,
  netCents: 300_000,
  bankRef: 'BANK-1',
  matched: false,
  ...over,
});

const line = (paymentId: string, amountCents: number, settlementId = 'stl_1'): SettlementLine => ({
  settlementId,
  paymentId,
  amountCents,
});

const known = new Set(['pay_1', 'pay_2']);

describe('reconcileSettlement', () => {
  it('matches when lines resolve to known payments and sum to the net', () => {
    const result = reconcileSettlement(
      settlement(),
      [line('pay_1', 180_000), line('pay_2', 120_000)],
      known,
    );
    expect(result.matched).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.lineTotalCents).toBe(300_000);
  });

  it('flags a settlement whose lines do not sum to the net', () => {
    const result = reconcileSettlement(settlement(), [line('pay_1', 299_999)], known);
    expect(result.matched).toBe(false);
    expect(result.issues).toContain('lines_do_not_sum_to_net');
  });

  it('flags a line pointing at an unknown payment', () => {
    const result = reconcileSettlement(settlement(), [line('pay_x', 300_000)], known);
    expect(result.matched).toBe(false);
    expect(result.issues).toContain('unknown_payment');
  });

  it('flags a settlement with no lines', () => {
    const result = reconcileSettlement(settlement(), [], known);
    expect(result.matched).toBe(false);
    expect(result.issues).toContain('no_lines');
  });

  it('ignores lines belonging to another settlement', () => {
    const result = reconcileSettlement(
      settlement(),
      [line('pay_1', 300_000), line('pay_2', 999, 'stl_other')],
      known,
    );
    expect(result.matched).toBe(true);
  });

  it('records a mismatch rather than throwing, so a batch keeps going', () => {
    expect(() => reconcileSettlement(settlement(), [line('pay_x', 1)], known)).not.toThrow();
  });
});

describe('reconcileAll', () => {
  it('returns one result per settlement in order', () => {
    const results = reconcileAll(
      [settlement(), settlement({ id: 'stl_2', netCents: 100_000 })],
      [line('pay_1', 300_000), line('pay_2', 100_000, 'stl_2')],
      known,
    );
    expect(results.map((r) => r.settlementId)).toEqual(['stl_1', 'stl_2']);
    expect(results.every((r) => r.matched)).toBe(true);
  });
});
