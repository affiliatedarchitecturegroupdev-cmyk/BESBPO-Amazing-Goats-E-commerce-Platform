import { WalletEntry, WalletMovement } from './wallet.rules';

/**
 * Persistence boundary for the advertiser wallet ledger (`ads.wallet_ledger`).
 * The in-memory store is the default so tests and local runs need no database;
 * the SQL adapter is selected with `STORE_DRIVER=sql`.
 */
export interface BillingStore {
  /** Every ledger row for an advertiser, oldest first. */
  ledger(advertiserOrgId: string): Promise<WalletEntry[]>;
  /** Append a movement and return the stored row. */
  append(movement: WalletMovement): Promise<WalletEntry>;
}

/** In-memory ledger, ordered by insertion. */
export class InMemoryBillingStore implements BillingStore {
  private readonly rows = new Map<string, WalletEntry[]>();
  private seq = 0;

  constructor(seed: WalletEntry[] = []) {
    for (const entry of seed) {
      const rows = this.rows.get(entry.advertiserOrgId) ?? [];
      rows.push(entry);
      this.rows.set(entry.advertiserOrgId, rows);
    }
  }

  async ledger(advertiserOrgId: string): Promise<WalletEntry[]> {
    return [...(this.rows.get(advertiserOrgId) ?? [])];
  }

  async append(movement: WalletMovement): Promise<WalletEntry> {
    const entry: WalletEntry = { ...movement, id: `wl_${++this.seq}` };
    const rows = this.rows.get(entry.advertiserOrgId) ?? [];
    rows.push(entry);
    this.rows.set(entry.advertiserOrgId, rows);
    return entry;
  }
}
