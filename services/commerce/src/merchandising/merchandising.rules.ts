import type { CatalogueItem } from '../catalog/catalog.types';
import {
  MerchItem,
  MerchPage,
  MerchSection,
  ResolvedMerchItem,
  ResolvedSection,
} from './merchandising.types';

/** Raised when a merchandising change is not allowed. */
export class MerchandisingError extends Error {}

/**
 * A section is visible when it is active and `at` falls inside its half-open
 * `[startsAt, endsAt)` window. A null bound is open-ended.
 */
export function isSectionVisible(section: MerchSection, at: Date): boolean {
  if (!section.active) return false;
  const t = at.getTime();
  if (section.startsAt && t < Date.parse(section.startsAt)) return false;
  if (section.endsAt && t >= Date.parse(section.endsAt)) return false;
  return true;
}

/** Items in display order: explicit sort, then SKU for a stable tie-break. */
export function orderItems(items: MerchItem[]): MerchItem[] {
  return [...items].sort((a, b) => a.sort - b.sort || a.sku.localeCompare(b.sku));
}

/**
 * Resolve one section against the catalogue. Items whose SKU is not in the
 * catalogue are dropped, so a removed product never leaves a broken tile; the
 * remaining items keep their display order.
 */
export function resolveSection(
  section: MerchSection,
  items: MerchItem[],
  catalogue: Map<string, CatalogueItem>,
): ResolvedSection {
  const resolved: ResolvedMerchItem[] = [];
  for (const item of orderItems(items.filter((i) => i.sectionId === section.id))) {
    const catalogueItem = catalogue.get(item.sku);
    if (!catalogueItem) continue;
    resolved.push({
      sku: item.sku,
      name: catalogueItem.name,
      pack: catalogueItem.pack,
      badge: item.badge,
      item: catalogueItem,
    });
  }
  return { code: section.code, title: section.title, page: section.page, items: resolved };
}

/**
 * The visible sections for a page at `at`, in sort order, each resolved against
 * the catalogue. Empty sections are dropped so the page never renders a blank
 * strip. `sort` is ascending; ties fall back to code for a stable order.
 */
export function visibleSectionsForPage(
  sections: MerchSection[],
  items: MerchItem[],
  catalogue: Map<string, CatalogueItem>,
  page: MerchPage,
  at: Date,
): ResolvedSection[] {
  return sections
    .filter((s) => s.page === page && isSectionVisible(s, at))
    .sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code))
    .map((s) => resolveSection(s, items, catalogue))
    .filter((s) => s.items.length > 0);
}

export function assertValidSection(section: MerchSection): void {
  if (!section.code) throw new MerchandisingError('a section needs a code');
  if (!section.title) throw new MerchandisingError(`section ${section.code} needs a title`);
  if (section.startsAt && section.endsAt && Date.parse(section.endsAt) <= Date.parse(section.startsAt)) {
    throw new MerchandisingError(`section ${section.code} ends before it starts`);
  }
}
