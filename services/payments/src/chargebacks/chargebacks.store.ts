import { Chargeback } from './chargebacks.types';

/** Persistence boundary for chargebacks; the SQL adapter lands with the store swap. */
export interface ChargebacksStore {
  all(): Promise<Chargeback[]>;
  get(id: string): Promise<Chargeback | undefined>;
  insert(chargeback: Chargeback): Promise<Chargeback>;
  replace(chargeback: Chargeback): Promise<Chargeback>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryChargebacksStore implements ChargebacksStore {
  private readonly byId = new Map<string, Chargeback>();

  constructor(seed: Chargeback[] = []) {
    for (const chargeback of seed) this.byId.set(chargeback.id, chargeback);
  }

  async all(): Promise<Chargeback[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Chargeback | undefined> {
    return this.byId.get(id);
  }

  async insert(chargeback: Chargeback): Promise<Chargeback> {
    this.byId.set(chargeback.id, chargeback);
    return chargeback;
  }

  async replace(chargeback: Chargeback): Promise<Chargeback> {
    this.byId.set(chargeback.id, chargeback);
    return chargeback;
  }
}
