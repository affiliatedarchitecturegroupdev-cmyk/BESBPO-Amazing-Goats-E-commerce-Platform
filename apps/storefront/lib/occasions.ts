import type { StorefrontItem } from './catalog';
import { isBoxItem } from './catalog';

/**
 * The occasion hubs (T-054, wireframe `sf-merch`). The page is the storefront's
 * view of a merchandising page: an occasion names the cooking methods and
 * budget bands the shopper can filter by, and the boxes and recipes that suit
 * it. This is presentation data, so it lives in the storefront rather than the
 * commerce service, which owns the curated *sections*.
 */
export interface Occasion {
  slug: string;
  label: string;
  blurb: string;
  cookingMethods: string[];
  recipeTitles: string[];
}

export const OCCASIONS: Occasion[] = [
  {
    slug: 'braai-day',
    label: 'Braai day',
    blurb: 'Boxes, cuts and sundries for a proper South African braai.',
    cookingMethods: ['Braai', 'Potjie', 'Roast', 'Slow cook'],
    recipeTitles: ['Lamb chops on the braai', 'Potjie with lamb shank'],
  },
  {
    slug: 'ceremony',
    label: 'Ceremony',
    blurb: 'Live animals and large cuts for ceremonies, weighed at collection.',
    cookingMethods: ['Potjie', 'Slow cook', 'Roast'],
    recipeTitles: ['Feeding a crowd with mutton'],
  },
  {
    slug: 'eid-and-easter',
    label: 'Eid and Easter',
    blurb: 'Halaal lamb and poultry, pre-ordered for the long weekend.',
    cookingMethods: ['Roast', 'Braai', 'Slow cook'],
    recipeTitles: ['Slow-roast leg of lamb'],
  },
  {
    slug: 'heritage-day',
    label: 'Heritage Day',
    blurb: 'Braai favourites and traditional cuts for Heritage Day.',
    cookingMethods: ['Braai', 'Potjie', 'Slow cook'],
    recipeTitles: ['Shisa nyama platter'],
  },
];

/** Budget bands as whole rand, matching the wireframe chips. */
export const BUDGET_BANDS: { label: string; maxCents: number }[] = [
  { label: 'Under R200', maxCents: 20_000 },
  { label: 'Under R500', maxCents: 50_000 },
  { label: 'Under R1,000', maxCents: 100_000 },
];

export function getOccasion(slug: string): Occasion | undefined {
  return OCCASIONS.find((o) => o.slug === slug);
}

/** The bundles for an occasion: the box line, which suits every occasion. */
export function bundlesFor(items: StorefrontItem[]): StorefrontItem[] {
  return items.filter(isBoxItem);
}

/** Items whose price is known and at or below the band, priced items first. */
export function withinBudget(items: StorefrontItem[], maxCents: number): StorefrontItem[] {
  return items.filter((i) => i.priceCents != null && i.priceCents <= maxCents);
}
