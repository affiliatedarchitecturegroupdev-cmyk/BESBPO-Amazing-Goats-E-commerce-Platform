import type { ServedAd } from './placements';

/**
 * Demo served ads for local runs, in the shape the ads decisioning endpoint
 * returns (services/ads AdPlacement). Every ad is already labelled by the
 * service; the storefront only places what it is given. Slots follow the
 * wireframes: A1/A2 banners, A3 category top, A4 grid tiles, A5 search top.
 */
export const DEMO_SERVED_ADS: ServedAd[] = [
  {
    creativeId: 'cr-a1',
    campaignId: 'c-1042',
    slot: 'A1',
    sponsored: true,
    label: 'Sponsored',
    headline: 'Braai season: brand banner',
    assetUrl: '/ads/a1-braai.svg',
    destinationUrl: '/occasions/braai-day',
  },
  {
    creativeId: 'cr-a2',
    campaignId: 'c-1042',
    slot: 'A2',
    sponsored: true,
    label: 'Sponsored',
    headline: 'Mid-page promotion',
    assetUrl: '/ads/a2-promo.svg',
    destinationUrl: '/shop/boxes',
  },
  {
    creativeId: 'cr-a3',
    campaignId: 'c-1039',
    slot: 'A3',
    sponsored: true,
    label: 'Sponsored',
    headline: 'Category sponsor',
    assetUrl: '/ads/a3-sponsor.svg',
    destinationUrl: '/shop/lamb',
  },
  {
    creativeId: 'cr-a4-charcoal',
    campaignId: 'c-1039',
    slot: 'A4',
    sponsored: true,
    label: 'Sponsored',
    headline: 'Charcoal brand',
    assetUrl: '/ads/a4-charcoal.svg',
    destinationUrl: '/shop/boxes',
  },
  {
    creativeId: 'cr-a4-spice',
    campaignId: 'c-1041',
    slot: 'A4',
    sponsored: true,
    label: 'Sponsored',
    headline: 'Spice brand',
    assetUrl: '/ads/a4-spice.svg',
    destinationUrl: '/shop/lamb',
  },
  {
    creativeId: 'cr-a5-1',
    campaignId: 'c-1041',
    slot: 'A5',
    sponsored: true,
    label: 'Sponsored',
    headline: 'Sponsored result: spice rub',
    assetUrl: '/ads/a5-spice.svg',
    destinationUrl: '/shop/lamb',
  },
  {
    creativeId: 'cr-a5-2',
    campaignId: 'c-1039',
    slot: 'A5',
    sponsored: true,
    label: 'Sponsored',
    headline: 'Sponsored result: charcoal',
    assetUrl: '/ads/a5-charcoal.svg',
    destinationUrl: '/shop/boxes',
  },
];

/** The served ads for one slot, at most two, in the order the service returned. */
export function servedAdsForSlot(slot: string): ServedAd[] {
  return DEMO_SERVED_ADS.filter((ad) => ad.slot === slot).slice(0, 2);
}
