import { Inject, Injectable } from '@nestjs/common';
import { BillingStore } from './billing.store';
import { WalletEntry, WalletError, balanceOf, creditWallet, debitWallet } from './wallet.rules';

export const BILLING_STORE = Symbol('BILLING_STORE');

/** A wallet's balance and the movements that produced it. */
export interface WalletSummary {
  advertiserOrgId: string;
  balanceCents: number;
  ledger: WalletEntry[];
}

/**
 * Advertiser wallet. Money movements are ledger rows; the balance is their sum,
 * computed by the pure rules so the API and a reconciliation job agree. A spend
 * that would overdraw is refused before anything is written.
 */
@Injectable()
export class BillingService {
  constructor(@Inject(BILLING_STORE) private readonly store: BillingStore) {}

  async wallet(advertiserOrgId: string): Promise<WalletSummary> {
    const ledger = await this.store.ledger(advertiserOrgId);
    return { advertiserOrgId, balanceCents: balanceOf(ledger), ledger };
  }

  async balance(advertiserOrgId: string): Promise<number> {
    return balanceOf(await this.store.ledger(advertiserOrgId));
  }

  /** Top up the wallet; returns the new balance. */
  async topUp(advertiserOrgId: string, amountCents: number, ref?: string): Promise<number> {
    const ledger = await this.store.ledger(advertiserOrgId);
    const balance = creditWallet(ledger, amountCents);
    await this.store.append({
      advertiserOrgId,
      kind: 'top_up',
      amountCents,
      ref,
      at: new Date().toISOString(),
    });
    return balance;
  }

  /**
   * Debit a spend (an impression or click charge). Refuses an overspend; the
   * debit is written as a negative movement so the ledger stays a sum.
   */
  async spend(advertiserOrgId: string, spendCents: number, ref?: string): Promise<number> {
    const ledger = await this.store.ledger(advertiserOrgId);
    const balance = debitWallet(ledger, spendCents);
    await this.store.append({
      advertiserOrgId,
      kind: 'spend',
      amountCents: -spendCents,
      ref,
      at: new Date().toISOString(),
    });
    return balance;
  }
}

export { WalletError };
