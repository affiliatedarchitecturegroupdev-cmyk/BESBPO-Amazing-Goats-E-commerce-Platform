/**
 * Frequency and click bookkeeping for decisioning. The counter is per user hash
 * and creative, so a cap follows the person without storing who they are
 * (docs/06-ads.md: no ads to children, frequency caps, POPIA). The in-memory
 * store is the default; a SQL adapter over `ads.impressions`/`ads.clicks` lands
 * with the store swap.
 */
export interface FrequencyStore {
  impressionsFor(userHash: string, creativeId: string): Promise<number>;
  recordImpression(userHash: string, creativeId: string, slotCode: string): Promise<void>;
  recordClick(userHash: string, creativeId: string): Promise<void>;
}

/** In-memory counters keyed by `${userHash}:${creativeId}`. */
export class InMemoryFrequencyStore implements FrequencyStore {
  private readonly impressions = new Map<string, number>();
  private readonly clicks = new Map<string, number>();

  private key(userHash: string, creativeId: string): string {
    return `${userHash}:${creativeId}`;
  }

  async impressionsFor(userHash: string, creativeId: string): Promise<number> {
    return this.impressions.get(this.key(userHash, creativeId)) ?? 0;
  }

  async recordImpression(userHash: string, creativeId: string): Promise<void> {
    const key = this.key(userHash, creativeId);
    this.impressions.set(key, (this.impressions.get(key) ?? 0) + 1);
  }

  async recordClick(userHash: string, creativeId: string): Promise<void> {
    const key = this.key(userHash, creativeId);
    this.clicks.set(key, (this.clicks.get(key) ?? 0) + 1);
  }
}
