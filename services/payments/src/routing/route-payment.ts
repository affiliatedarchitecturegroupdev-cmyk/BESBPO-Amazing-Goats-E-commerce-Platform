import { estimateFeeCents as estimateFeeFromSchedule } from './provider-fees';

export type Provider = 'peach' | 'payfast' | 'stitch' | 'tradesafe' | 'lulapay' | 'ozow' | 'yoco';
export type Method = 'pay_by_bank' | 'card' | 'wallet' | 'bnpl' | 'recurring_debit' | 'escrow' | 'trade_bnpl' | 'pos';
export const ESCROW_MINIMUM_CENTS = 1_000_000; // R10,000, because of the escrow minimum fee

/** Ordered list of providers to try. The first is primary, the rest are automatic fallbacks. */
export function routePayment(i: { method: Method; amountCents: number }): Provider[] {
  switch (i.method) {
    case 'pay_by_bank': return ['stitch', 'peach', 'payfast'];
    case 'card': return ['peach', 'payfast', 'stitch'];
    case 'wallet': return ['payfast', 'peach'];
    case 'bnpl': return ['peach', 'payfast'];
    case 'recurring_debit': return ['stitch'];
    case 'trade_bnpl': return ['lulapay'];
    case 'pos': return ['yoco'];
    case 'escrow':
      if (i.amountCents < ESCROW_MINIMUM_CENTS) throw new Error('Escrow is only offered from R10,000');
      return ['tradesafe'];
  }
}

/**
 * The provider fee, in cents. The models live in `provider-fees.ts` (one place
 * a rate changes, and one place a reviewer checks); `unquotedFeeModels` lists
 * the rates T-031 still has to confirm in writing.
 */
export function estimateFeeCents(provider: Provider, method: Method, amountCents: number): number {
  return estimateFeeFromSchedule(provider, method, amountCents);
}
