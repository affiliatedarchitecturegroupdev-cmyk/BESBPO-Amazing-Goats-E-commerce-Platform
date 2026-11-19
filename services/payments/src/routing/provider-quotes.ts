import { FeeEntry, PROVIDER_FEES, feeKey } from './provider-fees';
import type { Method, Provider } from './route-payment';
import type { SettlementTerms } from './settlement-terms';

/**
 * The written quotes a human records for T-031. The file is checked in empty
 * (everything `confirmed: false`) and filled from each provider's signed rate
 * card. `quoteDrift` compares a confirmed quote against the published figure the
 * code ships with, so a signed quote that disagrees is caught in review rather
 * than in production.
 */
export interface FeeQuote {
  provider: Provider;
  method: Method;
  percent: number;
  fixedCents?: number;
  quoteReference: string;
  receivedOn: string;
  confirmed: boolean;
}

export interface SettlementQuote {
  provider: Provider;
  settlementDays: number;
  cadence: SettlementTerms['cadence'];
  quoteReference: string;
  receivedOn: string;
  confirmed: boolean;
}

export interface QuoteRegistry {
  providerFees: FeeQuote[];
  settlement: SettlementQuote[];
}

import quotes from './provider-quotes.json';

/** The quote registry as checked in. */
export function readQuotes(): QuoteRegistry {
  return quotes as unknown as QuoteRegistry;
}

export interface FeeDrift {
  provider: Provider;
  method: Method;
  quoted: FeeQuote;
  published: FeeEntry;
}

/** Confirmed quotes that disagree with the published figure the code uses. */
export function quoteDrift(quotes: QuoteRegistry = readQuotes()): FeeDrift[] {
  const drift: FeeDrift[] = [];
  for (const quote of quotes.providerFees) {
    if (!quote.confirmed) continue;
    const published = PROVIDER_FEES[feeKey(quote.provider, quote.method)];
    if (!published) continue;
    if (published.percent !== quote.percent || (published.fixedCents ?? 0) !== (quote.fixedCents ?? 0)) {
      drift.push({ provider: quote.provider, method: quote.method, quoted: quote, published });
    }
  }
  return drift;
}

/** The provider/method pairs still waiting on a written quote. */
export function outstandingFeeQuotes(quotes: QuoteRegistry = readQuotes()): string[] {
  return quotes.providerFees
    .filter((q) => !q.confirmed)
    .map((q) => feeKey(q.provider, q.method))
    .sort();
}

/** The providers still waiting on confirmed settlement terms. */
export function outstandingSettlementQuotes(quotes: QuoteRegistry = readQuotes()): Provider[] {
  return quotes.settlement
    .filter((q) => !q.confirmed)
    .map((q) => q.provider)
    .sort();
}
