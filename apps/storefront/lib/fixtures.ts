import type { CatalogueItem } from '@ag/api-client';
import type { CartLine } from './cart';
import type { ServedAd } from './placements';

/**
 * Test fixtures only (T-049): the seed catalogue that used to feed the pages now
 * lives here, in the shape the gateway returns, so specs can exercise the real
 * mapping and rendering code without a running gateway.
 */
export const FIXTURE_CATALOGUE: CatalogueItem[] = [
  {
    id: 'v-full-lamb-box', sku: 'AG-LM-001', productId: 'p-lamb', name: 'Full lamb box',
    pack: 'About 17 kg', unit: 'box', fulfilment: 'pre_order_cycle', temperature: 'chilled',
    channel: 'both', phase: 1, lineCode: 'AG-LM', lineName: 'Lamb', categorySlug: 'lamb',
    halaalAvailable: true, active: true, priceCents: 189900,
  },
  {
    id: 'v-lamb-loin-chops', sku: 'AG-LM-002', productId: 'p-lamb', name: 'Lamb loin chops',
    pack: '400 g', unit: 'pack', fulfilment: 'pre_order_cycle', temperature: 'chilled',
    channel: 'both', phase: 1, lineCode: 'AG-LM', lineName: 'Lamb', categorySlug: 'lamb',
    halaalAvailable: true, active: true, priceCents: 12900,
  },
  {
    id: 'v-braai-box', sku: 'AG-BX-001', productId: 'p-box', name: 'Braai box',
    pack: '6 kg', unit: 'box', fulfilment: 'pre_order_cycle', temperature: 'frozen',
    channel: 'both', phase: 1, lineCode: 'AG-BX', lineName: 'Boxes', categorySlug: 'boxes',
    halaalAvailable: true, active: true, priceCents: 74900,
  },
  {
    id: 'v-eggs-tray', sku: 'AG-EG-001', productId: 'p-eggs', name: 'Eggs tray',
    pack: '30 eggs', unit: 'tray', fulfilment: 'in_stock', temperature: 'ambient',
    channel: 'both', phase: 1, lineCode: 'AG-EG', lineName: 'Eggs', categorySlug: 'eggs',
    halaalAvailable: false, active: true, priceCents: 8500,
  },
  {
    id: 'v-boer-wether', sku: 'AG-LG-005', productId: 'p-live', name: 'Boer wether',
    pack: 'Slaughter weight', unit: 'each', fulfilment: 'reservation', temperature: 'live',
    channel: 'both', phase: 1, lineCode: 'AG-LG', lineName: 'Live goats', categorySlug: 'live-animals',
    halaalAvailable: false, active: true, priceCents: 320000,
  },
];

export const FIXTURE_CART_LINES: CartLine[] = [
  { sku: 'AG-LM-001', name: 'Full lamb box', qty: 1, unitPriceExVatCents: 189900, fulfilment: 'pre_order_cycle', temperature: 'chilled' },
  { sku: 'AG-LG-005', name: 'Boer wether', qty: 1, unitPriceExVatCents: 320000, fulfilment: 'reservation', temperature: 'live' },
];

export const FIXTURE_ADS: ServedAd[] = [
  { creativeId: 'cr-a1', campaignId: 'c-1042', slot: 'A1', sponsored: true, label: 'Sponsored', headline: 'Braai season', assetUrl: '/ads/a1.svg' },
  { creativeId: 'cr-a4', campaignId: 'c-1039', slot: 'A4', sponsored: true, label: 'Sponsored', headline: 'Charcoal', assetUrl: '/ads/a4.svg' },
];
