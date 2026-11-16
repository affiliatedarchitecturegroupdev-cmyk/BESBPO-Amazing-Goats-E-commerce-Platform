import { describe, it, expect } from 'vitest';
import { WalletEntry, WalletError, balanceOf, creditWallet, debitWallet } from './wallet.rules';

const entry = (amountCents: number): WalletEntry => ({
  id: `e${amountCents}`,
  advertiserOrgId: 'org-1',
  kind: amountCents >= 0 ? 'top_up' : 'spend',
  amountCents,
  at: '2026-11-14T10:00:00.000Z',
});

describe('balanceOf', () => {
  it('sums the signed movements', () => {
    expect(balanceOf([entry(100_000), entry(-20_000), entry(5_000)])).toBe(85_000);
  });

  it('is zero for an empty ledger', () => {
    expect(balanceOf([])).toBe(0);
  });
});

describe('debitWallet', () => {
  it('returns the new balance on a spend within funds', () => {
    expect(debitWallet([entry(100_000)], 30_000)).toBe(70_000);
  });

  it('allows spending the exact balance', () => {
    expect(debitWallet([entry(100_000)], 100_000)).toBe(0);
  });

  it('rejects an overspend', () => {
    expect(() => debitWallet([entry(100_000)], 100_001)).toThrow(WalletError);
    expect(() => debitWallet([entry(100_000)], 100_001)).toThrow(/insufficient funds/);
  });

  it('rejects a zero or negative spend', () => {
    expect(() => debitWallet([entry(100_000)], 0)).toThrow(/positive/);
    expect(() => debitWallet([entry(100_000)], -5)).toThrow(/positive/);
  });

  it('rejects a non-integer amount', () => {
    expect(() => debitWallet([entry(100_000)], 10.5)).toThrow(/whole number/);
  });
});

describe('creditWallet', () => {
  it('adds a top-up to the balance', () => {
    expect(creditWallet([entry(100_000), entry(-20_000)], 50_000)).toBe(130_000);
  });

  it('rejects a non-positive top-up', () => {
    expect(() => creditWallet([], 0)).toThrow(/positive/);
    expect(() => creditWallet([], -1)).toThrow(/positive/);
  });
});
