import { Payout } from './payouts.types';

/** Persistence boundary for payouts; the SQL adapter over `payments.payouts` lands with the store swap. */
export interface PayoutsStore {
  all(): Promise<Payout[]>;
  get(id: string): Promise<Payout | undefined>;
  insert(payout: Payout): Promise<Payout>;
  replace(payout: Payout): Promise<Payout>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryPayoutsStore implements PayoutsStore {
  private readonly byId = new Map<string, Payout>();

  constructor(seed: Payout[] = []) {
    for (const payout of seed) this.byId.set(payout.id, payout);
  }

  async all(): Promise<Payout[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Payout | undefined> {
    return this.byId.get(id);
  }

  async insert(payout: Payout): Promise<Payout> {
    this.byId.set(payout.id, payout);
    return payout;
  }

  async replace(payout: Payout): Promise<Payout> {
    this.byId.set(payout.id, payout);
    return payout;
  }
}
