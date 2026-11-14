import type { Money } from '@ag/shared-types';

/** Audiences a price list can serve, matching catalog.price_lists.audience. */
export const PRICE_LIST_AUDIENCES = ['public', 'trader', 'trade_a', 'trade_b', 'bakery'] as const;
export type PriceListAudience = (typeof PRICE_LIST_AUDIENCES)[number];

/**
 * A price list is created as a draft, submitted for approval, then published by
 * a second person. `superseded` marks the previous list once a newer one for the
 * same audience goes live.
 */
export type PriceListStatus = 'draft' | 'pending_approval' | 'published' | 'superseded';

export interface PriceListItem {
  sku: string;
  /** Integer cents, excluding VAT. */
  priceExVatCents: Money;
  /** What the price is per: 'each', 'kg', 'dozen', ... */
  unitPriceBasis: string;
}

export interface PriceList {
  id: string;
  code: string;
  name: string;
  audience: PriceListAudience;
  /** ISO timestamps. */
  validFrom: string;
  validTo: string | null;
  status: PriceListStatus;
  items: PriceListItem[];
  /** Who created it; the publisher must be someone else (four-eyes). */
  requestedBy?: string;
  approvedBy?: string;
  publishedAt?: string;
}

/** A resolved price for one SKU, with the VAT breakdown the UI shows. */
export interface ResolvedPrice {
  sku: string;
  priceListCode: string;
  audience: PriceListAudience;
  priceExVatCents: Money;
  vatCents: Money;
  priceIncVatCents: Money;
  unitPriceBasis: string;
}
