import { describe, it, expect } from 'vitest';
import { addVat, formatRand, formatRandIncVat, STANDARD_VAT_RATE } from './format';

describe('formatRandIncVat', () => {
  it('adds 15% VAT to a price list price', () => {
    // R290.00 excl -> R333.50 incl.
    expect(formatRandIncVat(29000)).toBe(formatRand(33350));
  });

  it('rounds to the cent rather than truncating', () => {
    // 1005 * 1.15 = 1155.75 -> 1156
    expect(addVat(1005)).toBe(1156);
  });

  it('agrees with the cart, which applies the same standard rate', () => {
    expect(STANDARD_VAT_RATE).toBe(0.15);
    expect(addVat(10000)).toBe(11500);
  });

  it('leaves a zero price at zero rather than inventing VAT', () => {
    expect(addVat(0)).toBe(0);
  });
});
