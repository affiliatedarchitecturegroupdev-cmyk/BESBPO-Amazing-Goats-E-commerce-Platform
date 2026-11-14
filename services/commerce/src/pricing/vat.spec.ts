import { describe, it, expect } from 'vitest';
import { addVat, removeVat, vatBreakdown, VAT_RATE_PERCENT } from './vat';

describe('vat', () => {
  it('adds 15%', () => { expect(addVat(270000)).toBe(310500); });
  it('removes 15%', () => { expect(removeVat(310500)).toBe(270000); });

  it('defaults to the South African standard rate', () => {
    expect(VAT_RATE_PERCENT).toBe(15);
    expect(vatBreakdown(10000).ratePercent).toBe(15);
  });

  it('accepts an explicit rate (e.g. zero-rated goods)', () => {
    expect(addVat(10000, 0)).toBe(10000);
    expect(vatBreakdown(10000, 0)).toEqual({ exVatCents: 10000, vatCents: 0, incVatCents: 10000, ratePercent: 0 });
  });

  it('splits an amount into parts that add up', () => {
    const b = vatBreakdown(270000);
    expect(b).toEqual({ exVatCents: 270000, vatCents: 40500, incVatCents: 310500, ratePercent: 15 });
    expect(b.exVatCents + b.vatCents).toBe(b.incVatCents);
  });

  it('rounds to whole cents', () => {
    // 999 * 1.15 = 1148.85 -> 1149
    expect(addVat(999)).toBe(1149);
    expect(vatBreakdown(999).vatCents).toBe(150);
  });
});
