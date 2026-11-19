import type { Method, Provider } from './route-payment';

/**
 * One provider's fee for one method, as a percentage plus a fixed cent amount,
 * with an optional floor. `estimateFeeCents` is the only place this is applied,
 * so a rate change is a one-line edit to `PROVIDER_FEES` and nothing else.
 */
export interface FeeModel {
  /** Percentage of the transaction, e.g. 3.2 for 3.2%. */
  percent: number;
  /** Fixed cents added to the percentage. */
  fixedCents?: number;
  /** Floor in cents, applied to the percentage before the fixed part. */
  minCents?: number;
}

export interface FeeEntry extends FeeModel {
  /** True once the provider has confirmed the rate in writing (T-031). */
  quoted: boolean;
  /** Where the figure came from, so a reviewer can check it. */
  source: string;
}

const PUBLISHED = 'Provider published rate card, read November 2026';

/**
 * Published rates excluding VAT, keyed `provider/method`. These are the figures
 * the business plans against; `quoted` stays false until T-031 records a
 * written quote, so `unquotedFeeModels` can list what a human still owes.
 */
export const PROVIDER_FEES: Record<string, FeeEntry> = {
  'payfast/card': { percent: 3.2, fixedCents: 200, quoted: false, source: PUBLISHED },
  'payfast/pay_by_bank': { percent: 2, minCents: 200, quoted: false, source: PUBLISHED },
  'peach/card': { percent: 2.95, fixedCents: 150, quoted: false, source: PUBLISHED },
  'peach/pay_by_bank': { percent: 1.5, fixedCents: 150, quoted: false, source: PUBLISHED },
  'stitch/card': { percent: 2.95, quoted: false, source: PUBLISHED },
  'tradesafe/escrow': { percent: 1.5, minCents: 10_000, quoted: false, source: PUBLISHED },
};

/** The key a fee model is looked up by. */
export function feeKey(provider: Provider, method: Method): string {
  return `${provider}/${method}`;
}

/** The fee entry for a provider and method, or undefined when none is recorded. */
export function feeEntry(provider: Provider, method: Method): FeeEntry | undefined {
  return PROVIDER_FEES[feeKey(provider, method)];
}

/** Apply a fee model to an amount, in cents. */
export function applyFee(model: FeeModel, amountCents: number): number {
  const variable = Math.round((amountCents * model.percent) / 100) + (model.fixedCents ?? 0);
  return Math.max(model.minCents ?? 0, variable);
}

/** The estimated provider fee, in cents. Throws when no model is recorded. */
export function estimateFeeCents(provider: Provider, method: Method, amountCents: number): number {
  const entry = feeEntry(provider, method);
  if (!entry) throw new Error(`No fee model for ${feeKey(provider, method)}`);
  return applyFee(entry, amountCents);
}

/** Every provider/method whose rate is still a published figure, not a written quote. */
export function unquotedFeeModels(): string[] {
  return Object.entries(PROVIDER_FEES)
    .filter(([, entry]) => !entry.quoted)
    .map(([key]) => key)
    .sort();
}
