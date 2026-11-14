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

/** Published rates, excluding VAT, checked November 2026. TODO(T-031): confirm in writing with each provider. */
export function estimateFeeCents(provider: Provider, method: Method, amountCents: number): number {
  const pct = (p: number, fixed = 0, min = 0) => Math.max(min, Math.round((amountCents * p) / 100) + fixed);
  if (provider === 'payfast' && method === 'card') return pct(3.2, 200);
  if (provider === 'payfast' && method === 'pay_by_bank') return pct(2, 0, 200);
  if (provider === 'peach' && method === 'card') return pct(2.95, 150);
  if (provider === 'peach' && method === 'pay_by_bank') return pct(1.5, 150);
  if (provider === 'stitch' && method === 'card') return pct(2.95);
  if (provider === 'tradesafe') return pct(1.5, 0, 10000);
  throw new Error(`No fee model for ${provider}/${method}`);
}
