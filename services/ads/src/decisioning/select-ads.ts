export interface AdCandidate {
  id: string; slot: string; categories: string[]; bidCents: number; remainingBudgetCents: number;
  approved: boolean; frequencyCap: number; impressionsForUser: number;
}
export const MAX_ADS_PER_VIEW = 2;
/** At most one sponsored tile in every five grid tiles. */
export const maxSponsoredTiles = (gridSize: number): number => Math.floor(gridSize / 5);

export function selectAds(candidates: AdCandidate[], ctx: { slot: string; category?: string; maxAds: number }): AdCandidate[] {
  const limit = Math.min(ctx.maxAds, MAX_ADS_PER_VIEW);
  return candidates
    .filter((c) => c.approved && c.slot === ctx.slot && c.remainingBudgetCents >= c.bidCents && c.impressionsForUser < c.frequencyCap)
    .map((c) => ({ c, score: c.bidCents + (ctx.category && c.categories.includes(ctx.category) ? 50 : 0) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.c);
}
