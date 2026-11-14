import type { PaymentMethod } from '@ag/shared-types';

/** Pay by bank is cheaper for us, so we pass about 1% back to the customer. */
export const PAY_BY_BANK_DISCOUNT_RATE = 0.01;

/** Escrow is only offered from R10,000 (TradeSafe minimum fee). */
export const ESCROW_MINIMUM_CENTS = 1_000_000;

export type CheckoutMethod = PaymentMethod | 'deposit';

export interface PaymentOption {
  method: CheckoutMethod;
  label: string;
  detail: string;
  recommended?: boolean;
  /** Cents taken off the total when this method is chosen. */
  discountCents?: number;
}

/**
 * Payment options for checkout, pay-by-bank first. Escrow appears from R10,000
 * and the reservation deposit only when the cart has a live-animal reservation.
 */
export function paymentOptions(totalCents: number, opts: { hasReservation?: boolean } = {}): PaymentOption[] {
  const options: PaymentOption[] = [
    {
      method: 'pay_by_bank',
      label: 'Pay by bank',
      detail: 'Capitec Pay, PayShap, Instant EFT · 1% discount',
      recommended: true,
      discountCents: Math.round(totalCents * PAY_BY_BANK_DISCOUNT_RATE),
    },
    { method: 'card', label: 'Card', detail: 'Peach with PayFast fallback' },
    { method: 'wallet', label: 'Wallets and pay later', detail: 'Payflex, Float, MoreTyme, Mobicred' },
    { method: 'bnpl', label: 'Buy now, pay later', detail: 'Payflex, Mobicred' },
  ];
  if (opts.hasReservation) {
    options.push({ method: 'deposit', label: 'Deposit', detail: 'For live-animal reservations' });
  }
  if (totalCents >= ESCROW_MINIMUM_CENTS) {
    options.push({ method: 'escrow', label: 'Escrow', detail: 'TradeSafe, from R10,000' });
  }
  return options;
}

/** Total after the pay-by-bank discount, if that method is chosen. */
export function totalWithDiscount(totalCents: number, option: PaymentOption): number {
  return totalCents - (option.discountCents ?? 0);
}

export const TRADE_NOTE =
  'Trade accounts: pay on account, EFT, or LulaPay terms. Orders above R10,000 can use TradeSafe escrow.';
