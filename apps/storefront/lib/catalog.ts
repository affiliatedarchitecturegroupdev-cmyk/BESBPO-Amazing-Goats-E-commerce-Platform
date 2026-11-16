import type { StorefrontItem } from '@ag/api-client';

/** The shared catalogue view model, re-exported so the storefront imports it in one place. */
export { badgesFor, toStorefrontItem, toStorefrontItems } from '@ag/api-client';
export type { Badge, StorefrontItem } from '@ag/api-client';

export interface Category {
  slug: string;
  label: string;
}

export const CATEGORIES: Category[] = [
  { slug: 'lamb', label: 'Lamb' },
  { slug: 'boxes', label: 'Boxes' },
  { slug: 'chicken', label: 'Chicken' },
  { slug: 'eggs', label: 'Eggs' },
  { slug: 'dairy', label: 'Dairy' },
  { slug: 'produce', label: 'Produce' },
  { slug: 'live-animals', label: 'Live animals' },
];

export function getBySku(items: StorefrontItem[], sku: string): StorefrontItem | undefined {
  return items.find((i) => i.sku === sku);
}

export function byCategory(items: StorefrontItem[], category: string): StorefrontItem[] {
  return items.filter((i) => i.category === category);
}

export function featuredBoxes(items: StorefrontItem[]): StorefrontItem[] {
  return byCategory(items, 'boxes');
}

export function specials(items: StorefrontItem[]): StorefrontItem[] {
  return items.filter((i) => i.special);
}
