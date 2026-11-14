import type { Channel, FulfilmentType, Money, Phase, Temperature } from '@ag/shared-types';

/** A sellable variant joined with its product and line, as the catalogue reads it. */
export interface CatalogueItem {
  id: string;
  sku: string;
  productId: string;
  name: string;
  pack: string;
  unit: string;
  fulfilment: FulfilmentType;
  temperature: Temperature;
  channel: Channel;
  phase: Phase;
  lineCode: string;
  lineName: string;
  categorySlug: string | null;
  halaalAvailable: boolean;
  active: boolean;
  priceCents?: Money;
}

/** Filters accepted by the catalogue list and search endpoints. */
export interface CatalogueFilters {
  /** Product line code (AG-LG) or name (Live goats), case-insensitive. */
  line?: string;
  /** Category slug, case-insensitive. */
  category?: string;
  fulfilment?: FulfilmentType;
  channel?: Channel;
  phase?: Phase;
  temperature?: Temperature;
}

export interface SearchOptions {
  limit?: number;
  /** Minimum average token score for an item to be returned. */
  minScore?: number;
  /** Minimum similarity before a token is offered as a correction. */
  didYouMeanThreshold?: number;
}

export interface SearchResult {
  query: string;
  didYouMean: string | null;
  count: number;
  items: CatalogueItem[];
}
