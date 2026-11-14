import type { Channel, FulfilmentType, Phase, Temperature, Variant } from '@ag/shared-types';

/** A sellable variant as the storefront shows it, with the merchandising flags we render as badges. */
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

const item = (
  over: Pick<Variant, 'id' | 'sku' | 'name' | 'pack' | 'unit' | 'fulfilment'> &
    Partial<Variant> & {
      category: string;
      line: string;
      halaalAvailable?: boolean;
      farmDirect?: boolean;
      lowStock?: boolean;
      special?: boolean;
      inStock?: boolean;
    },
): StorefrontItem => ({
  productId: over.id,
  temperature: 'chilled' as Temperature,
  channel: 'both' as Channel,
  phase: 1 as Phase,
  ...over,
  halaalAvailable: over.halaalAvailable ?? false,
  farmDirect: over.farmDirect ?? true,
  lowStock: over.lowStock ?? false,
  special: over.special ?? false,
  inStock: over.inStock ?? false,
});

/** Phase 1 range the storefront shows while the catalogue service is wired up. */
export const ITEMS: StorefrontItem[] = [
  item({ id: 'v-full-lamb-box', sku: 'AG-LM-001', name: 'Full lamb box', pack: 'About 17 kg', unit: 'box', fulfilment: 'pre_order_cycle', category: 'lamb', line: 'Lamb', halaalAvailable: true, priceCents: 189900 }),
  item({ id: 'v-lamb-loin-chops', sku: 'AG-LM-002', name: 'Lamb loin chops', pack: '400 g', unit: 'pack', fulfilment: 'pre_order_cycle', category: 'lamb', line: 'Lamb', halaalAvailable: true, priceCents: 12900 }),
  item({ id: 'v-lamb-shanks', sku: 'AG-LM-003', name: 'Lamb shanks', pack: '1 kg', unit: 'pack', fulfilment: 'pre_order_cycle', category: 'lamb', line: 'Lamb', halaalAvailable: true, priceCents: 15900 }),
  item({ id: 'v-lamb-mince', sku: 'AG-LM-004', name: 'Lamb mince', pack: '500 g', unit: 'pack', fulfilment: 'pre_order_cycle', category: 'lamb', line: 'Lamb', halaalAvailable: true, lowStock: true, priceCents: 9900 }),
  item({ id: 'v-lamb-rib-chops', sku: 'AG-LM-005', name: 'Lamb rib chops', pack: '600 g', unit: 'pack', fulfilment: 'pre_order_cycle', category: 'lamb', line: 'Lamb', halaalAvailable: true, priceCents: 13900 }),
  item({ id: 'v-lamb-potjie', sku: 'AG-LM-006', name: 'Lamb potjie pack', pack: '1.5 kg', unit: 'pack', fulfilment: 'pre_order_cycle', category: 'lamb', line: 'Lamb', halaalAvailable: true, priceCents: 17900 }),

  item({ id: 'v-braai-box', sku: 'AG-BX-001', name: 'Braai box', pack: '6 kg', unit: 'box', fulfilment: 'pre_order_cycle', category: 'boxes', line: 'Boxes', halaalAvailable: true, priceCents: 74900 }),
  item({ id: 'v-potjie-box', sku: 'AG-BX-002', name: 'Potjie box', pack: '5 kg', unit: 'box', fulfilment: 'pre_order_cycle', category: 'boxes', line: 'Boxes', halaalAvailable: true, priceCents: 64900 }),
  item({ id: 'v-family-freezer-box', sku: 'AG-BX-003', name: 'Family freezer box', pack: '12 kg', unit: 'box', fulfilment: 'pre_order_cycle', category: 'boxes', line: 'Boxes', priceCents: 129900 }),
  item({ id: 'v-weekly-essentials', sku: 'AG-BX-004', name: 'Weekly essentials', pack: '8 kg', unit: 'box', fulfilment: 'reservation', category: 'boxes', line: 'Boxes', priceCents: 89900 }),

  item({ id: 'v-chicken-braai', sku: 'AG-CH-001', name: 'Braai chicken portions', pack: '2 kg', unit: 'pack', fulfilment: 'pre_order_cycle', category: 'chicken', line: 'Chicken', halaalAvailable: true, priceCents: 16900 }),

  item({ id: 'v-eggs-tray', sku: 'AG-EG-001', name: 'Eggs tray', pack: '30 eggs', unit: 'tray', fulfilment: 'in_stock', category: 'eggs', line: 'Eggs', special: true, inStock: true, priceCents: 8500 }),
  item({ id: 'v-eggs-bakery', sku: 'AG-EG-002', name: 'Eggs for bakeries', pack: '360 eggs', unit: 'case', fulfilment: 'pre_order_cycle', category: 'eggs', line: 'Eggs', priceCents: 74900 }),

  item({ id: 'v-milk-2l', sku: 'AG-DY-001', name: 'Fresh milk', pack: '2 L', unit: 'bottle', fulfilment: 'pre_order_cycle', category: 'dairy', line: 'Dairy', priceCents: 4200 }),
  item({ id: 'v-amasi-1l', sku: 'AG-DY-002', name: 'Amasi', pack: '1 L', unit: 'bottle', fulfilment: 'pre_order_cycle', category: 'dairy', line: 'Dairy', priceCents: 3900 }),

  item({ id: 'v-spinach-bunch', sku: 'AG-PR-001', name: 'Spinach', pack: 'bunch', unit: 'each', fulfilment: 'pre_order_cycle', category: 'produce', line: 'Produce', priceCents: 2500 }),
  item({ id: 'v-butternut', sku: 'AG-PR-002', name: 'Butternut', pack: '1 kg', unit: 'each', fulfilment: 'pre_order_cycle', category: 'produce', line: 'Produce', lowStock: true, priceCents: 3200 }),

  item({ id: 'v-boer-wether', sku: 'AG-LG-005', name: 'Boer wether', pack: 'Slaughter weight', unit: 'each', fulfilment: 'reservation', category: 'live-animals', line: 'Live goats', temperature: 'live', priceCents: 320000 }),
];

export function getBySlug(slug: string): StorefrontItem | undefined {
  return ITEMS.find((i) => i.id === slug);
}

export function byCategory(category: string): StorefrontItem[] {
  return ITEMS.filter((i) => i.category === category);
}

export function featuredBoxes(): StorefrontItem[] {
  return byCategory('boxes');
}

export function produceItems(): StorefrontItem[] {
  return byCategory('produce');
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

export function isFulfilment(t: FulfilmentType): boolean {
  return ['in_stock', 'pre_order_cycle', 'reservation', 'quote', 'seasonal_pre_order'].includes(t);
}
