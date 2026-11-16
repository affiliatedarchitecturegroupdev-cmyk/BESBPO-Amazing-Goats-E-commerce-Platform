import { Promotion } from './promotions.types';

/** Persistence boundary for promotions; the SQL adapter over sales.promotions lands with the store swap. */
export interface PromotionStore {
  all(): Promise<Promotion[]>;
  get(id: string): Promise<Promotion | undefined>;
  insert(promotion: Promotion): Promise<Promotion>;
  replace(promotion: Promotion): Promise<Promotion>;
}

/** In-memory store used by tests and local runs until the SQL adapter is wired. */
export class InMemoryPromotionStore implements PromotionStore {
  private readonly byId = new Map<string, Promotion>();

  constructor(seed: Promotion[] = []) {
    for (const promotion of seed) this.byId.set(promotion.id, promotion);
  }

  async all(): Promise<Promotion[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Promotion | undefined> {
    return this.byId.get(id);
  }

  async insert(promotion: Promotion): Promise<Promotion> {
    this.byId.set(promotion.id, promotion);
    return promotion;
  }

  async replace(promotion: Promotion): Promise<Promotion> {
    this.byId.set(promotion.id, promotion);
    return promotion;
  }
}
