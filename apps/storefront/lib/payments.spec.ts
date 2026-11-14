import { describe, it, expect } from 'vitest';
import { ESCROW_MINIMUM_CENTS, paymentOptions, PAY_BY_BANK_DISCOUNT_RATE, totalWithDiscount } from './payments';

describe('paymentOptions', () => {
  it('lists pay by bank first and marks it recommended', () => {
    const options = paymentOptions(100000);
    expect(options[0].method).toBe('pay_by_bank');
    expect(options[0].recommended).toBe(true);
  });

  it('offers about 1% back on pay by bank', () => {
    const [payByBank] = paymentOptions(100000);
    expect(payByBank.discountCents).toBe(100000 * PAY_BY_BANK_DISCOUNT_RATE);
    expect(totalWithDiscount(100000, payByBank)).toBe(99000);
  });

  it('shows the deposit only for live-animal reservations', () => {
    expect(paymentOptions(100000).some((o) => o.method === 'deposit')).toBe(false);
    expect(paymentOptions(100000, { hasReservation: true }).some((o) => o.method === 'deposit')).toBe(true);
  });

  it('shows escrow only from R10,000', () => {
    expect(paymentOptions(ESCROW_MINIMUM_CENTS - 1).some((o) => o.method === 'escrow')).toBe(false);
    expect(paymentOptions(ESCROW_MINIMUM_CENTS).some((o) => o.method === 'escrow')).toBe(true);
  });

  it('leaves the total unchanged when there is no discount', () => {
    const card = paymentOptions(100000).find((o) => o.method === 'card')!;
    expect(totalWithDiscount(100000, card)).toBe(100000);
  });
});
