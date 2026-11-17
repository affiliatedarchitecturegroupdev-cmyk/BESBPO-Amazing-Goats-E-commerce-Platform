import type { MerchCatalogueItem, ResolvedSection } from '@ag/api-client';
import { toStorefrontItem, type StorefrontItem } from './catalog';

/**
 * The storefront's view of the merchandising the gateway resolved (T-040). The
 * commerce service decides which sections exist and which SKUs they hold; this
 * module only turns a resolved section into the cards a screen renders, using
 * the same view model as the rest of the storefront.
 */

/** The tile as a card: the view model plus the badge the editor chose. */
export interface MerchCard {
  item: StorefrontItem;
  badge: string | null;
}

/** One section as a screen renders it: a heading and its cards. */
export interface MerchSection {
  code: string;
  title: string;
  cards: MerchCard[];
}

/** The code of the catalogue fallback section, so a screen can single it out. */
export const CATALOGUE_SECTION_CODE = 'catalogue';

/** Turn one resolved tile into a card, mapping its catalogue row to the view model. */
export function toMerchCard(tile: { badge: string | null; item: MerchCatalogueItem }): MerchCard {
  return { item: toStorefrontItem(tile.item), badge: tile.badge };
}

/** Turn one resolved section into a render-ready section. */
export function toMerchSection(section: ResolvedSection): MerchSection {
  return { code: section.code, title: section.title, cards: section.items.map(toMerchCard) };
}

/** Turn every resolved section into a render-ready section. */
export function toMerchSections(sections: ResolvedSection[]): MerchSection[] {
  return sections.map(toMerchSection);
}

/**
 * The first tile of a section, for the hero image the wireframe shows. A
 * section with no tiles has no hero.
 */
export function sectionHero(section: MerchSection): StorefrontItem | undefined {
  return section.cards[0]?.item;
}
