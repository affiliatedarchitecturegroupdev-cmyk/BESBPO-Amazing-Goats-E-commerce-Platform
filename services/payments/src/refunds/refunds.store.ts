import { Refund } from './refunds.types';

/** Persistence boundary for refunds; the SQL adapter over `payments.refunds` lands with the store swap. */
export interface RefundsStore {
  all(): Promise<Refund[]>;
  get(id: string): Promise<Refund | undefined>;
  insert(refund: Refund): Promise<Refund>;
  replace(refund: Refund): Promise<Refund>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryRefundsStore implements RefundsStore {
  private readonly byId = new Map<string, Refund>();

  constructor(seed: Refund[] = []) {
    for (const refund of seed) this.byId.set(refund.id, refund);
  }

  async all(): Promise<Refund[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Refund | undefined> {
    return this.byId.get(id);
  }

  async insert(refund: Refund): Promise<Refund> {
    this.byId.set(refund.id, refund);
    return refund;
  }

  async replace(refund: Refund): Promise<Refund> {
    this.byId.set(refund.id, refund);
    return refund;
  }
}
