import type { Provider } from './route-payment';

/**
 * The settlement terms the platform relies on for each provider, as published.
 * `confirmed` stays false until T-031 records a written quote; the fields are the
 * ones reconciliation and cash-flow planning depend on.
 */
export interface SettlementTerms {
  provider: Provider;
  /** Days from transaction to funds in the bank account, as published. */
  settlementDays: number;
  /** How often a settlement batch is produced. */
  cadence: 'daily' | 'weekly' | 'on_demand';
  /** True when the provider pays out on weekends and public holidays. */
  includesWeekends: boolean;
  /** Refund window in days, or null when not published. */
  refundWindowDays: number | null;
  /** Chargeback window in days, or null when not published. */
  chargebackWindowDays: number | null;
  /** True once a human has the terms in writing (T-031). */
  confirmed: boolean;
  source: string;
}

const PUBLISHED = 'Provider published terms, read November 2026';

export const SETTLEMENT_TERMS: Record<Provider, SettlementTerms> = {
  peach: { provider: 'peach', settlementDays: 2, cadence: 'daily', includesWeekends: false, refundWindowDays: 180, chargebackWindowDays: 180, confirmed: false, source: PUBLISHED },
  payfast: { provider: 'payfast', settlementDays: 2, cadence: 'daily', includesWeekends: false, refundWindowDays: null, chargebackWindowDays: 120, confirmed: false, source: PUBLISHED },
  stitch: { provider: 'stitch', settlementDays: 1, cadence: 'daily', includesWeekends: true, refundWindowDays: null, chargebackWindowDays: null, confirmed: false, source: PUBLISHED },
  tradesafe: { provider: 'tradesafe', settlementDays: 3, cadence: 'on_demand', includesWeekends: false, refundWindowDays: null, chargebackWindowDays: null, confirmed: false, source: PUBLISHED },
  lulapay: { provider: 'lulapay', settlementDays: 30, cadence: 'weekly', includesWeekends: false, refundWindowDays: null, chargebackWindowDays: null, confirmed: false, source: 'Trade terms pilot' },
  ozow: { provider: 'ozow', settlementDays: 1, cadence: 'daily', includesWeekends: true, refundWindowDays: null, chargebackWindowDays: null, confirmed: false, source: PUBLISHED },
  yoco: { provider: 'yoco', settlementDays: 1, cadence: 'daily', includesWeekends: true, refundWindowDays: null, chargebackWindowDays: null, confirmed: false, source: PUBLISHED },
};

/** The terms for a provider. */
export function settlementTerms(provider: Provider): SettlementTerms {
  return SETTLEMENT_TERMS[provider];
}

/**
 * The date a payment made on `paidOn` is expected to settle. Days are calendar
 * days (the published terms do not promise business days), so the caller can
 * compare the promise against a real bank credit.
 */
export function expectedSettlementDate(provider: Provider, paidOn: Date): Date {
  const date = new Date(paidOn.getTime());
  date.setUTCDate(date.getUTCDate() + settlementTerms(provider).settlementDays);
  return date;
}

/** Every provider whose settlement terms a human still has to confirm. */
export function unconfirmedSettlementTerms(): Provider[] {
  return (Object.values(SETTLEMENT_TERMS).filter((t) => !t.confirmed).map((t) => t.provider) as Provider[]).sort();
}
