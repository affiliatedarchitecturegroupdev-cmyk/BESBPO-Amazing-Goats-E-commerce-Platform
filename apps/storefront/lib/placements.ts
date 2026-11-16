/**
 * Storefront placement of served retail-media ads (T-029). The ads service
 * decides *which* ads to serve (services/ads/src/decisioning/serve-ads.ts,
 * built on `selectAds`); the storefront places what it is given. Every ad
 * carries the label the service set, and this module refuses to render an ad
 * that is not labelled Sponsored.
 */

import { MAX_ADS_PER_VIEW, maxSponsoredTiles } from './merchandising';
import type { ServedAd } from '@ag/api-client';

export type { ServedAd } from '@ag/api-client';

export interface AdView extends ServedAd {
  /** The label to render; always the service's label, defaulted to Sponsored. */
  label: string;
}

/** The label every ad must show (docs/06-ads.md). */
export const SPONSORED = 'Sponsored';

/**
 * An ad is renderable only when it is marked sponsored and carries the label.
 * This is the storefront's last line of defence: an unlabelled ad is dropped,
 * never shown.
 */
export function isRenderableAd(ad: ServedAd): boolean {
  return ad.sponsored === true && (ad.label === SPONSORED || ad.label === 'Sponsored');
}

/** Keep only renderable ads, and never more than two in one view. */
export function renderableAds(ads: ServedAd[]): AdView[] {
  return ads
    .filter(isRenderableAd)
    .slice(0, MAX_ADS_PER_VIEW)
    .map((ad) => ({ ...ad, label: ad.label || SPONSORED }));
}

export interface PlacedAd<T> {
  item: T;
  ad?: AdView;
}

/**
 * Drop served ads into a grid at fixed 1-based positions, never exceeding one
 * sponsored tile per five or two per view. The label travels with the ad, so a
 * placed ad is always labelled.
 */
export function placeAds<T>(items: T[], ads: ServedAd[], positions: number[] = [3, 7, 11]): PlacedAd<T>[] {
  const usable = renderableAds(ads);
  const allowance = Math.min(maxSponsoredTiles(items.length), MAX_ADS_PER_VIEW, usable.length);
  const out: PlacedAd<T>[] = items.map((item) => ({ item }));
  for (let i = 0; i < allowance; i += 1) {
    const at = positions[i] - 1;
    if (at >= 0 && at < out.length) out[at] = { item: items[at], ad: usable[i] };
  }
  return out;
}

/** The ads for a slot, in the order the service returned them, at most two. */
export function adsForSlot(ads: ServedAd[], slot: string): AdView[] {
  return renderableAds(ads).filter((ad) => ad.slot === slot);
}
