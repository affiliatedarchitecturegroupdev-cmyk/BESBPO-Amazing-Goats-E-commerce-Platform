import { Campaign } from './campaign-rules';

/**
 * Persistence boundary for campaigns. The SQL adapter lands with the store swap;
 * the in-memory store is the default so tests and local runs need no database.
 */
export interface CampaignsStore {
  all(): Promise<Campaign[]>;
  get(id: string): Promise<Campaign | undefined>;
  insert(campaign: Campaign): Promise<Campaign>;
  replace(campaign: Campaign): Promise<Campaign>;
}

/** In-memory store keyed by campaign id. */
export class InMemoryCampaignsStore implements CampaignsStore {
  private readonly byId = new Map<string, Campaign>();

  constructor(seed: Campaign[] = []) {
    for (const campaign of seed) this.byId.set(campaign.id, campaign);
  }

  async all(): Promise<Campaign[]> {
    return [...this.byId.values()];
  }

  async get(id: string): Promise<Campaign | undefined> {
    return this.byId.get(id);
  }

  async insert(campaign: Campaign): Promise<Campaign> {
    this.byId.set(campaign.id, campaign);
    return campaign;
  }

  async replace(campaign: Campaign): Promise<Campaign> {
    if (!this.byId.has(campaign.id)) throw new Error(`campaign ${campaign.id} not found`);
    this.byId.set(campaign.id, campaign);
    return campaign;
  }
}
