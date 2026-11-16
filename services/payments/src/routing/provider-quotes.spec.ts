import { describe, it, expect } from 'vitest';
import {
  QuoteRegistry,
  outstandingFeeQuotes,
  outstandingSettlementQuotes,
  quoteDrift,
  readQuotes,
} from './provider-quotes';

const empty: QuoteRegistry = readQuotes();

describe('readQuotes', () => {
  it('ships an unconfirmed registry', () => {
    expect(empty.providerFees.length).toBeGreaterThan(0);
    expect(empty.providerFees.every((q) => !q.confirmed)).toBe(true);
    expect(empty.settlement.every((q) => !q.confirmed)).toBe(true);
  });
});

describe('outstandingFeeQuotes', () => {
  it('lists every pair still waiting on a written quote', () => {
    expect(outstandingFeeQuotes(empty)).toEqual(['payfast/card', 'peach/card']);
  });

  it('drops a pair once its quote is confirmed', () => {
    const filled: QuoteRegistry = {
      ...empty,
      providerFees: empty.providerFees.map((q) =>
        q.provider === 'peach' ? { ...q, confirmed: true, quoteReference: 'PEACH-2026-11' } : q,
      ),
    };
    expect(outstandingFeeQuotes(filled)).toEqual(['payfast/card']);
  });
});

describe('outstandingSettlementQuotes', () => {
  it('lists the providers still to confirm', () => {
    expect(outstandingSettlementQuotes(empty)).toEqual(['peach']);
  });
});

describe('quoteDrift', () => {
  it('flags a confirmed quote that disagrees with the published figure', () => {
    const drifted: QuoteRegistry = {
      ...empty,
      providerFees: [{ ...empty.providerFees[0], confirmed: true, percent: 3.5, fixedCents: 200 }],
    };
    const drift = quoteDrift(drifted);
    expect(drift).toHaveLength(1);
    expect(drift[0]).toMatchObject({ provider: 'payfast', method: 'card' });
    expect(drift[0].published.percent).toBe(3.2);
  });

  it('reports no drift when the quote matches', () => {
    const matched: QuoteRegistry = {
      ...empty,
      providerFees: [{ ...empty.providerFees[0], confirmed: true }],
    };
    expect(quoteDrift(matched)).toEqual([]);
  });

  it('ignores an unconfirmed quote', () => {
    expect(quoteDrift(empty)).toEqual([]);
  });
});
