import { describe, it, expect } from 'vitest';
import {
  expectedSettlementDate,
  settlementTerms,
  unconfirmedSettlementTerms,
} from './settlement-terms';

describe('settlementTerms', () => {
  it('records the published terms for the primary providers', () => {
    expect(settlementTerms('peach')).toMatchObject({ settlementDays: 2, cadence: 'daily' });
    expect(settlementTerms('stitch')).toMatchObject({ settlementDays: 1, includesWeekends: true });
    expect(settlementTerms('lulapay').settlementDays).toBe(30);
  });
});

describe('expectedSettlementDate', () => {
  it('adds the settlement days to the payment date', () => {
    const paid = new Date('2026-11-02T09:00:00.000Z');
    expect(expectedSettlementDate('peach', paid).toISOString()).toBe('2026-11-04T09:00:00.000Z');
    expect(expectedSettlementDate('stitch', paid).toISOString()).toBe('2026-11-03T09:00:00.000Z');
  });

  it('rolls over a month boundary', () => {
    const paid = new Date('2026-11-30T22:00:00.000Z');
    expect(expectedSettlementDate('peach', paid).toISOString()).toBe('2026-12-02T22:00:00.000Z');
  });
});

describe('unconfirmedSettlementTerms', () => {
  it('lists every provider a human still has to confirm (T-031)', () => {
    expect(unconfirmedSettlementTerms()).toEqual(['lulapay', 'ozow', 'payfast', 'peach', 'stitch', 'tradesafe', 'yoco']);
  });
});
