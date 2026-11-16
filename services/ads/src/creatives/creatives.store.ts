import { Creative } from '../campaigns/campaign-rules';

/**
 * Persistence boundary for creatives. The SQL adapter lands with the store swap;
 * the in-memory store is the default so tests and local runs need no database.
 */
export interface CreativesStore {
  all(): Promise<Creative[]>;
  get(id: string): Promise<Creative | undefined>;
  byCampaign(campaignId: string): Promise<Creative[]>;
  insert(creative: Creative): Promise<Creative>;
  replace(creative: Creative): Promise<Creative>;
}

/** In-memory store keyed by creative id. */
export class InMemoryCreativesStore implements CreativesStore {
  private readonly byId = new Map<string, Creative>();

  constructor(seed: Creative[] = []) {
    for (const creative of seed) this.byId.set(creative.id, creative);
  }

  async all(): Promise<Creative[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Creative | undefined> {
    return this.byId.get(id);
  }

  async byCampaign(campaignId: string): Promise<Creative[]> {
    return [...this.byId.values()].filter((c) => c.campaignId === campaignId);
  }

  async insert(creative: Creative): Promise<Creative> {
    this.byId.set(creative.id, creative);
    return creative;
  }

  async replace(creative: Creative): Promise<Creative> {
    if (!this.byId.has(creative.id)) throw new Error(`creative ${creative.id} not found`);
    this.byId.set(creative.id, creative);
    return creative;
  }
}
