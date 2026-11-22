import type { FulfilmentType } from '@ag/shared-types';
import { formatRand } from './format';
import { SITE_DESCRIPTION, SITE_NAME, siteUrl } from './seo';

/**
 * Structured data (T-073). Each generator takes the object the page already
 * renders and returns a schema.org node, so the markup cannot describe a
 * different product from the one on screen. Prices come from the same cents the
 * page formats, which is why `productJsonLd` takes `priceCents` rather than a
 * string.
 *
 * Everything here is pure: no fetching, no environment reads except through an
 * explicit argument, so a test can pin the output.
 */

export type JsonLdNode = Record<string, unknown>;

/** schema.org `@context`, present on every node we emit. */
export const JSONLD_CONTEXT = 'https://schema.org';

/**
 * Serialise a node for a `<script type="application/ld+json">` block.
 *
 * `JSON.stringify` alone is not safe inside HTML: a `</script>` in a product
 * name ends the block and the rest becomes page markup. Escaping `<`, `>` and
 * `&` as JSON unicode escapes keeps the output valid JSON — a parser reads
 * `\u003c` as `<` — while removing every character that could close the tag.
 * U+2028/U+2029 are escaped too because they are line terminators in
 * JavaScript string literals.
 */
export function serializeJsonLd(value: JsonLdNode | JsonLdNode[]): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

/** Drop undefined keys so the emitted JSON carries no `"key": undefined` noise. */
function compact<T extends Record<string, unknown>>(node: T): JsonLdNode {
  return Object.fromEntries(Object.entries(node).filter(([, v]) => v !== undefined));
}

/** A price in cents as the decimal string schema.org expects (`18999` → `189.99`). */
export function priceDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * The displayed price as a number, so a test can compare it with the markup.
 * `formatRand` is the single display function the pages use; parsing its output
 * is what ties the JSON-LD price to what a shopper actually sees.
 */
export function displayedPriceValue(cents: number): number {
  return Number(formatRand(cents).replace(/[^\d,]/g, '').replace(',', '.'));
}

/** schema.org availability for a fulfilment type. */
export function availabilityFor(fulfilment: FulfilmentType): string {
  switch (fulfilment) {
    case 'in_stock':
      return 'https://schema.org/InStock';
    case 'pre_order_cycle':
    case 'seasonal_pre_order':
      return 'https://schema.org/PreOrder';
    case 'reservation':
      return 'https://schema.org/LimitedAvailability';
    case 'quote':
      return 'https://schema.org/InStoreOnly';
  }
}

export interface OfferInput {
  priceCents?: number;
  fulfilment: FulfilmentType;
  url: string;
  /** ISO date after which the price may change. Omitted when unknown. */
  priceValidUntil?: string;
}

/**
 * A single `Offer`. Returns `undefined` for a quote item: an offer with no
 * price is invalid markup, and the page shows "price on request" rather than a
 * number, so there is nothing truthful to state.
 *
 * `valueAddedTaxIncluded: false` is the platform rule (`docs/13-pricing.md`:
 * prices are stored excluding VAT and added at display). Stating it in the
 * markup keeps a rich result from quoting a price lower than the till charges.
 */
export function offerJsonLd(input: OfferInput): JsonLdNode | undefined {
  if (input.priceCents == null) return undefined;
  const price = priceDecimal(input.priceCents);
  return compact({
    '@type': 'Offer',
    url: input.url,
    priceCurrency: 'ZAR',
    price,
    availability: availabilityFor(input.fulfilment),
    priceValidUntil: input.priceValidUntil,
    priceSpecification: {
      '@type': 'UnitPriceSpecification',
      price,
      priceCurrency: 'ZAR',
      valueAddedTaxIncluded: false,
    },
  });
}

export interface AggregateRatingInput {
  /** Published ratings only, from the T-070 aggregate. */
  ratingCount: number;
  averageRating: number | null;
}

/**
 * `AggregateRating`, or `undefined` when there is nothing to state.
 *
 * Marking up a rating that the page does not show is a spam signal, so the
 * guard is the count rather than the caller's judgement: no published ratings
 * means no rating node, whatever the page asks for.
 */
export function aggregateRatingJsonLd(input: AggregateRatingInput): JsonLdNode | undefined {
  if (input.ratingCount <= 0 || input.averageRating == null) return undefined;
  return {
    '@type': 'AggregateRating',
    ratingCount: input.ratingCount,
    ratingValue: input.averageRating,
    bestRating: 5,
    worstRating: 1,
  };
}

export interface ProductInput {
  name: string;
  sku: string;
  url: string;
  description?: string;
  category?: string;
  imageUrl?: string;
  brand?: string;
  priceCents?: number;
  fulfilment: FulfilmentType;
  priceValidUntil?: string;
  aggregate?: AggregateRatingInput;
}

/** A `Product` with its `Offer` and, only when the page shows one, its rating. */
export function productJsonLd(input: ProductInput): JsonLdNode {
  return compact({
    '@context': JSONLD_CONTEXT,
    '@type': 'Product',
    name: input.name,
    sku: input.sku,
    url: input.url,
    description: input.description,
    category: input.category,
    image: input.imageUrl,
    brand: { '@type': 'Brand', name: input.brand ?? SITE_NAME },
    offers: offerJsonLd({
      priceCents: input.priceCents,
      fulfilment: input.fulfilment,
      url: input.url,
      priceValidUntil: input.priceValidUntil,
    }),
    aggregateRating: input.aggregate ? aggregateRatingJsonLd(input.aggregate) : undefined,
  });
}

export interface Crumb {
  name: string;
  /** Path relative to the site root, e.g. `/shop/lamb`. */
  path: string;
}

/** A `BreadcrumbList`; the home crumb is added when the caller omits it. */
export function breadcrumbJsonLd(crumbs: Crumb[], baseUrl?: string): JsonLdNode {
  const base = siteUrl(baseUrl);
  const all = crumbs[0]?.path === '/' ? crumbs : [{ name: 'Home', path: '/' }, ...crumbs];
  return {
    '@context': JSONLD_CONTEXT,
    '@type': 'BreadcrumbList',
    itemListElement: all.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.path === '/' ? `${base}/` : `${base}${c.path}`,
    })),
  };
}

/**
 * The crumbs for a product page, and the category to name in its `Product` node.
 *
 * `StorefrontItem.category` falls back to a slugified line name when a variant
 * has no category (`view-models.ts`), and such a slug is not a `/shop/[category]`
 * route. Only a category the shop actually renders earns a crumb, so the markup
 * never links a crawler to a page that does not exist.
 */
export function productTrail(
  input: { name: string; path: string; categorySlug?: string },
  categories: { slug: string; label: string }[],
): { crumbs: Crumb[]; categoryLabel?: string } {
  const known = categories.find((c) => c.slug === input.categorySlug);
  return {
    crumbs: [
      ...(known ? [{ name: known.label, path: `/shop/${known.slug}` }] : []),
      { name: input.name, path: input.path },
    ],
    categoryLabel: known?.label,
  };
}

export interface OrganizationInput {
  baseUrl?: string;
  email?: string;
  phone?: string;
  /** Areas the business delivers to, by name. */
  areaServed?: string[];
}

/**
 * Contact details, but only the ones that are actually configured.
 *
 * The legal pages still carry `[phone]` / `[email]` placeholders, so inventing a
 * number here would publish a fake contact point to search engines. Unset means
 * the field is absent, not empty.
 */
export function contactFromEnv(env: NodeJS.ProcessEnv = process.env): {
  email?: string;
  phone?: string;
} {
  const email = env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
  const phone = env.NEXT_PUBLIC_CONTACT_PHONE?.trim();
  return compact({ email: email || undefined, phone: phone || undefined }) as {
    email?: string;
    phone?: string;
  };
}

/**
 * `Organization` sitewide, with the delivery area.
 *
 * Deliberately `Organization` and not `LocalBusiness`: `LocalBusiness` expects a
 * street address, and the real one is not published yet. Emitting a placeholder
 * address would be worse than emitting none.
 */
export function organizationJsonLd(input: OrganizationInput = {}): JsonLdNode {
  const base = siteUrl(input.baseUrl);
  const areas = input.areaServed ?? ['KwaZulu-Natal', 'South Africa'];
  return compact({
    '@context': JSONLD_CONTEXT,
    '@type': 'Organization',
    '@id': `${base}/#organization`,
    name: SITE_NAME,
    url: `${base}/`,
    description: SITE_DESCRIPTION,
    areaServed: areas.map((name) =>
      name === 'South Africa'
        ? { '@type': 'Country', name }
        : {
            '@type': 'AdministrativeArea',
            name,
            containedInPlace: { '@type': 'Country', name: 'South Africa' },
          },
    ),
    contactPoint:
      input.email || input.phone
        ? [
            compact({
              '@type': 'ContactPoint',
              contactType: 'customer service',
              email: input.email,
              telephone: input.phone,
              areaServed: 'ZA',
              availableLanguage: 'en',
            }),
          ]
        : undefined,
  });
}

export interface FaqItem {
  question: string;
  answer: string;
}

/** A `FAQPage`. Blank questions or answers are dropped: an empty answer is a
 *  malformed entry, not a question the page can answer. */
export function faqJsonLd(items: FaqItem[]): JsonLdNode | undefined {
  const usable = items.filter((i) => i.question.trim() && i.answer.trim());
  if (usable.length === 0) return undefined;
  return {
    '@context': JSONLD_CONTEXT,
    '@type': 'FAQPage',
    mainEntity: usable.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}

export interface ArticleInput {
  headline: string;
  url: string;
  description?: string;
  imageUrl?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  section?: string;
}

/** An `Article` for a blog post or buying guide. */
export function articleJsonLd(input: ArticleInput): JsonLdNode {
  return compact({
    '@context': JSONLD_CONTEXT,
    '@type': 'Article',
    headline: input.headline,
    url: input.url,
    description: input.description,
    image: input.imageUrl,
    datePublished: input.datePublished,
    dateModified: input.dateModified ?? input.datePublished,
    articleSection: input.section,
    author: { '@type': 'Organization', name: input.authorName ?? SITE_NAME },
    publisher: { '@type': 'Organization', name: SITE_NAME },
  });
}

/** Minutes as an ISO 8601 duration (`90` → `PT1H30M`), which `totalTime` wants. */
export function isoDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return `PT${hours > 0 ? `${hours}H` : ''}${mins > 0 || hours === 0 ? `${mins}M` : ''}`;
}

export interface RecipeInput {
  name: string;
  url: string;
  description?: string;
  imageUrl?: string;
  servings: number;
  prepMinutes: number;
  cookMinutes: number;
  ingredients: string[];
  steps: string[];
  category?: string;
  datePublished?: string;
  authorName?: string;
}

/** A `Recipe` for `/recipes/[slug]` (T-072). */
export function recipeJsonLd(input: RecipeInput): JsonLdNode {
  return compact({
    '@context': JSONLD_CONTEXT,
    '@type': 'Recipe',
    name: input.name,
    url: input.url,
    description: input.description,
    image: input.imageUrl,
    recipeYield: `${input.servings} servings`,
    prepTime: isoDuration(input.prepMinutes),
    cookTime: isoDuration(input.cookMinutes),
    totalTime: isoDuration(input.prepMinutes + input.cookMinutes),
    recipeCategory: input.category,
    recipeIngredient: input.ingredients,
    recipeInstructions: input.steps.map((text) => ({ '@type': 'HowToStep', text })),
    datePublished: input.datePublished,
    author: { '@type': 'Organization', name: input.authorName ?? SITE_NAME },
  });
}
