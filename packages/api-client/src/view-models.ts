import type { Channel, FulfilmentType, Money, Phase, Temperature, Variant } from '@ag/shared-types';
import type { CatalogueItem } from './index';

/**
 * The catalogue row as the apps render it. The gateway catalogue carries the
 * identity and price; the merchandising flags (`special`, `lowStock`,
 * `farmDirect`, `inStock`) are not on it yet, so they default rather than
 * guess. Keeping the mapping here means the storefront, trade portal and staff
 * portals all read the same view model.
 */
export interface StorefrontItem extends Variant {
  category: string;
  line: string;
  halaalAvailable: boolean;
  farmDirect: boolean;
  lowStock: boolean;
  special: boolean;
  inStock: boolean;
}

export type Badge = 'farm_direct' | 'halaal' | 'low_stock' | 'special' | 'sponsored';

export function toStorefrontItem(item: CatalogueItem): StorefrontItem {
  return {
    id: item.id,
    sku: item.sku,
    productId: item.productId,
    name: item.name,
    pack: item.pack,
    unit: item.unit,
    fulfilment: item.fulfilment as FulfilmentType,
    temperature: item.temperature as Temperature,
    channel: item.channel as Channel,
    phase: item.phase as Phase,
    ...(item.priceCents != null ? { priceCents: item.priceCents as Money } : {}),
    category: item.categorySlug ?? item.lineName.toLowerCase().replace(/\s+/g, '-'),
    line: item.lineName,
    halaalAvailable: item.halaalAvailable,
    farmDirect: true,
    lowStock: false,
    special: false,
    inStock: item.fulfilment === 'in_stock',
  };
}

export function toStorefrontItems(items: CatalogueItem[]): StorefrontItem[] {
  return items.map(toStorefrontItem);
}

/** Badges to show on a card, in priority order. */
export function badgesFor(i: StorefrontItem): Badge[] {
  const badges: Badge[] = [];
  if (i.farmDirect) badges.push('farm_direct');
  if (i.halaalAvailable) badges.push('halaal');
  if (i.special) badges.push('special');
  if (i.lowStock) badges.push('low_stock');
  return badges;
}
