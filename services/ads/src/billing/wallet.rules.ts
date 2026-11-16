/**
 * Advertiser wallet rules (docs/06-ads.md). A wallet is an append-only ledger of
 * signed movements; the balance is their sum. Every check lives in a pure
 * function here so the API, the advertiser portal and a future reconciliation
 * job agree on what a balance is and when a spend is refused.
 */

export type WalletKind = 'top_up' | 'spend' | 'adjustment';

/** One ledger row. `amountCents` is signed: a credit is positive, a debit negative. */
export interface WalletEntry {
  id: string;
  advertiserOrgId: string;
  kind: WalletKind;
  amountCents: number;
  ref?: string;
  at: string;
}

/** A movement before the store assigns its id. */
export type WalletMovement = Omit<WalletEntry, 'id'>;

/** Raised when a wallet operation is not allowed. */
export class WalletError extends Error {}

/** The balance: the sum of every signed movement. */
export function balanceOf(ledger: readonly WalletEntry[]): number {
  return ledger.reduce((sum, entry) => sum + entry.amountCents, 0);
}

function requirePositive(amountCents: number, what: string): void {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new WalletError(`${what} must be a positive whole number of cents`);
  }
}

/**
 * Debit a spend from the wallet. Refuses a non-positive amount and an overspend
 * (a spend larger than the balance), and returns the new balance.
 */
export function debitWallet(ledger: readonly WalletEntry[], spendCents: number): number {
  requirePositive(spendCents, 'a spend');
  const balance = balanceOf(ledger);
  if (spendCents > balance) {
    throw new WalletError(`insufficient funds: balance is ${balance}, spend is ${spendCents}`);
  }
  return balance - spendCents;
}

/** Credit a top-up to the wallet and return the new balance. */
export function creditWallet(ledger: readonly WalletEntry[], amountCents: number): number {
  requirePositive(amountCents, 'a top-up');
  return balanceOf(ledger) + amountCents;
}
