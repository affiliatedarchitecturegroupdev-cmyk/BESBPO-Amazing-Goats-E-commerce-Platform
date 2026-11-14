/** Retail-media placement rules from docs/06-ads.md, shared with the ads service. */
export const MAX_ADS_PER_VIEW = 2;

/** At most one sponsored tile in every five grid tiles. */
export function maxSponsoredTiles(gridSize: number): number {
  return Math.floor(gridSize / 5);
}

export interface Placed<T> {
  item: T;
  sponsored: boolean;
  slot?: string;
}

/**
 * Place sponsored tiles into a product grid at fixed 1-based positions (A4 uses
 * 3, 7, 11). Never exceeds one sponsored tile per five, or two per view.
 */
export function placeSponsored<T>(items: T[], sponsored: { item: T; slot: string }[], positions: number[] = [3, 7, 11]): Placed<T>[] {
  const out: Placed<T>[] = items.map((item) => ({ item, sponsored: false }));
  const allowance = Math.min(maxSponsoredTiles(items.length), MAX_ADS_PER_VIEW, sponsored.length);
  for (let i = 0; i < allowance; i += 1) {
    const at = positions[i] - 1;
    if (at >= 0 && at < out.length) out[at] = { item: sponsored[i].item, sponsored: true, slot: sponsored[i].slot };
  }
  return out;
}

/** Hero and mid-page banners: at most two per view. */
export function viewBanners<T>(banners: T[]): T[] {
  return banners.slice(0, MAX_ADS_PER_VIEW);
}
