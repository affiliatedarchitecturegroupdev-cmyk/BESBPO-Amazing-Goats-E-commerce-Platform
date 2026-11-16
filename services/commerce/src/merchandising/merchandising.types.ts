import type { CatalogueItem } from '../catalog/catalog.types';

/** The pages a merchandising section can live on, matching catalog.merch_sections.page. */
export const MERCH_PAGES = ['home', 'category', 'shop'] as const;
export type MerchPage = (typeof MERCH_PAGES)[number];

/** A curated section: a titled strip of SKUs for a page, optionally time-boxed. */
export interface MerchSection {
  id: string;
  code: string;
  title: string;
  page: MerchPage;
  sort: number;
  active: boolean;
  /** ISO timestamps; the section is visible inside the half-open `[startsAt, endsAt)` window. */
  startsAt: string | null;
  endsAt: string | null;
}

/** A SKU placed in a section, with an explicit order and an optional badge. */
export interface MerchItem {
  sectionId: string;
  sku: string;
  sort: number;
  badge: string | null;
}

/** A section with its items resolved against the catalogue, ready to render. */
export interface ResolvedSection {
  code: string;
  title: string;
  page: MerchPage;
  items: ResolvedMerchItem[];
}

export interface ResolvedMerchItem {
  sku: string;
  name: string;
  pack: string;
  badge: string | null;
  item: CatalogueItem;
}
