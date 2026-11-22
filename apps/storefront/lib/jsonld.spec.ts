import { describe, it, expect } from 'vitest';
import type { StorefrontItem } from './catalog';
import { formatRand } from './format';
import {
  aggregateRatingJsonLd,
  articleJsonLd,
  availabilityFor,
  breadcrumbJsonLd,
  displayedPriceValue,
  faqJsonLd,
  isoDuration,
  offerJsonLd,
  organizationJsonLd,
  priceDecimal,
  productJsonLd,
  productTrail,
  recipeJsonLd,
  serializeJsonLd,
} from './jsonld';
import { FIXTURE_CATALOGUE } from './fixtures';
import { toStorefrontItems } from './catalog';

const BASE = 'https://amazinggoats.store';
const items: StorefrontItem[] = toStorefrontItems(FIXTURE_CATALOGUE);
const lamb = items.find((i) => i.sku === 'AG-LM-002')!;
const box = items.find((i) => i.sku === 'AG-LM-001')!;

describe('priceDecimal', () => {
  it('renders cents as the decimal string schema.org expects', () => {
    expect(priceDecimal(18999)).toBe('189.99');
    expect(priceDecimal(100000)).toBe('1000.00');
    expect(priceDecimal(0)).toBe('0.00');
  });
});

/**
 * The card calls this test non-optional: drifted structured data earns a manual
 * action. The comparison is against `formatRand`, the function the page renders
 * with, so the markup and the visible price can only disagree if the generator
 * stops using the same cents.
 */
describe('JSON-LD price equals the price the page displays', () => {
  for (const sku of ['AG-LM-001', 'AG-LM-002', 'AG-BX-001']) {
    it(`states the same price for ${sku} as the page shows`, () => {
      const v = items.find((i) => i.sku === sku)!;
      const node = productJsonLd({
        name: v.name,
        sku: v.sku,
        url: `${BASE}/product/${v.sku}`,
        priceCents: v.priceCents,
        fulfilment: v.fulfilment,
      });
      const offer = node.offers as Record<string, unknown>;
      const displayed = formatRand(v.priceCents!);
      // What a shopper reads, parsed back to a number.
      expect(displayedPriceValue(v.priceCents!)).toBe(Number(offer.price));
      // And the same value as the rendered string, formatted identically.
      expect(formatRand(Number(offer.price) * 100)).toBe(displayed);
    });
  }

  it('puts the same price in the offer and its priceSpecification', () => {
    const offer = offerJsonLd({
      priceCents: lamb.priceCents,
      fulfilment: lamb.fulfilment,
      url: `${BASE}/product/${lamb.sku}`,
    })!;
    expect((offer.priceSpecification as Record<string, unknown>).price).toBe(offer.price);
  });

  it('states ZAR and that the price excludes VAT, the platform rule', () => {
    const offer = offerJsonLd({
      priceCents: lamb.priceCents,
      fulfilment: lamb.fulfilment,
      url: `${BASE}/product/${lamb.sku}`,
    })!;
    expect(offer.priceCurrency).toBe('ZAR');
    const spec = offer.priceSpecification as Record<string, unknown>;
    expect(spec.valueAddedTaxIncluded).toBe(false);
    expect(spec.priceCurrency).toBe('ZAR');
  });

  it('emits no offer at all for a quote item, which has no price', () => {
    expect(offerJsonLd({ fulfilment: 'quote', url: `${BASE}/product/x` })).toBeUndefined();
    const node = productJsonLd({
      name: 'Boer wether',
      sku: 'AG-LG-005',
      url: `${BASE}/product/AG-LG-005`,
      fulfilment: 'quote',
    });
    expect(node.offers).toBeUndefined();
    expect(node.aggregateRating).toBeUndefined();
  });
});

describe('availabilityFor', () => {
  it('maps each fulfilment type to its schema.org term', () => {
    expect(availabilityFor('in_stock')).toBe('https://schema.org/InStock');
    expect(availabilityFor('pre_order_cycle')).toBe('https://schema.org/PreOrder');
    expect(availabilityFor('seasonal_pre_order')).toBe('https://schema.org/PreOrder');
    expect(availabilityFor('reservation')).toBe('https://schema.org/LimitedAvailability');
    expect(availabilityFor('quote')).toBe('https://schema.org/InStoreOnly');
  });

  it('reaches the offer for a cycle product', () => {
    const offer = offerJsonLd({
      priceCents: box.priceCents,
      fulfilment: box.fulfilment,
      url: `${BASE}/product/${box.sku}`,
    })!;
    expect(offer.availability).toBe('https://schema.org/PreOrder');
  });
});

/**
 * T-070's aggregate is the only permitted source, and a rating the page does not
 * show must not be marked up. The generator enforces that itself rather than
 * trusting the caller, because the caller is a page that may forget.
 */
describe('AggregateRating is never emitted without published reviews', () => {
  it('returns nothing for zero ratings', () => {
    expect(aggregateRatingJsonLd({ ratingCount: 0, averageRating: null })).toBeUndefined();
    expect(aggregateRatingJsonLd({ ratingCount: 0, averageRating: 4.5 })).toBeUndefined();
  });

  it('returns nothing when the average is missing even if a count exists', () => {
    expect(aggregateRatingJsonLd({ ratingCount: 3, averageRating: null })).toBeUndefined();
  });

  it('omits the node from a product that has no ratings', () => {
    const node = productJsonLd({
      name: lamb.name,
      sku: lamb.sku,
      url: `${BASE}/product/${lamb.sku}`,
      priceCents: lamb.priceCents,
      fulfilment: lamb.fulfilment,
      aggregate: { ratingCount: 0, averageRating: null },
    });
    expect(node).not.toHaveProperty('aggregateRating');
    expect(serializeJsonLd(node)).not.toContain('AggregateRating');
  });

  it('emits the aggregate when reviews are published', () => {
    const node = productJsonLd({
      name: lamb.name,
      sku: lamb.sku,
      url: `${BASE}/product/${lamb.sku}`,
      priceCents: lamb.priceCents,
      fulfilment: lamb.fulfilment,
      aggregate: { ratingCount: 12, averageRating: 4.6 },
    });
    expect(node.aggregateRating).toEqual({
      '@type': 'AggregateRating',
      ratingCount: 12,
      ratingValue: 4.6,
      bestRating: 5,
      worstRating: 1,
    });
  });
});

describe('serializeJsonLd', () => {
  it('produces valid JSON that round-trips', () => {
    const node = productJsonLd({
      name: lamb.name,
      sku: lamb.sku,
      url: `${BASE}/product/${lamb.sku}`,
      priceCents: lamb.priceCents,
      fulfilment: lamb.fulfilment,
    });
    expect(JSON.parse(serializeJsonLd(node))).toEqual(node);
  });

  it('cannot be closed by a script tag hidden in a product name', () => {
    const hostile = productJsonLd({
      name: 'Lamb</script><script>alert(1)</script>',
      sku: 'AG-X-001',
      url: `${BASE}/product/AG-X-001`,
      priceCents: 1000,
      fulfilment: 'in_stock',
    });
    const out = serializeJsonLd(hostile);
    expect(out).not.toContain('</script>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<');
    // Still parses, and the text survives intact for a consumer.
    expect(JSON.parse(out).name).toBe('Lamb</script><script>alert(1)</script>');
  });

  it('escapes an ampersand, so an entity cannot be formed', () => {
    const out = serializeJsonLd({ '@type': 'Thing', name: 'Lamb & mutton' });
    expect(out).not.toContain('&');
    expect(JSON.parse(out).name).toBe('Lamb & mutton');
  });
});

describe('breadcrumbJsonLd', () => {
  it('adds the home crumb and numbers the positions', () => {
    const node = breadcrumbJsonLd([{ name: 'Lamb', path: '/shop/lamb' }], BASE);
    const list = node.itemListElement as Record<string, unknown>[];
    expect(list.map((l) => l.position)).toEqual([1, 2]);
    expect(list[0].item).toBe(`${BASE}/`);
    expect(list[1].item).toBe(`${BASE}/shop/lamb`);
  });

  it('does not duplicate a home crumb the caller supplied', () => {
    const node = breadcrumbJsonLd(
      [{ name: 'Home', path: '/' }, { name: 'Lamb', path: '/shop/lamb' }],
      BASE,
    );
    expect((node.itemListElement as unknown[]).length).toBe(2);
  });
});

/**
 * `StorefrontItem.category` is a slugified line name when a variant has no
 * category, and `/shop/biltong-and-droewors` is not a route. A crumb that 404s
 * teaches a crawler the site is broken, so only a rendered category is used.
 */
describe('productTrail', () => {
  const categories = [
    { slug: 'lamb', label: 'Lamb' },
    { slug: 'boxes', label: 'Boxes' },
  ];

  it('names and links a category the shop renders', () => {
    const trail = productTrail({ name: 'Lamb loin chops', path: '/product/AG-LM-002', categorySlug: 'lamb' }, categories);
    expect(trail.categoryLabel).toBe('Lamb');
    expect(trail.crumbs).toEqual([
      { name: 'Lamb', path: '/shop/lamb' },
      { name: 'Lamb loin chops', path: '/product/AG-LM-002' },
    ]);
  });

  it('drops the category crumb for a fallback slug that has no page', () => {
    const trail = productTrail(
      { name: 'Beef biltong', path: '/product/AG-BD-001', categorySlug: 'biltong-and-droewors' },
      categories,
    );
    expect(trail.categoryLabel).toBeUndefined();
    expect(trail.crumbs).toEqual([{ name: 'Beef biltong', path: '/product/AG-BD-001' }]);
  });

  it('never emits a /shop/null crumb when the category is missing', () => {
    const trail = productTrail({ name: 'Mystery box', path: '/product/X' }, categories);
    expect(trail.crumbs.some((c) => c.path.includes('null') || c.path.includes('undefined'))).toBe(false);
  });

  it('produces a breadcrumb whose every item is an absolute URL', () => {
    const trail = productTrail({ name: 'Lamb loin chops', path: '/product/AG-LM-002', categorySlug: 'lamb' }, categories);
    const node = breadcrumbJsonLd(trail.crumbs, BASE);
    const list = node.itemListElement as Record<string, unknown>[];
    for (const item of list) expect(String(item.item).startsWith(`${BASE}/`)).toBe(true);
  });
});

describe('organizationJsonLd', () => {
  it('names the business and the KZN delivery area', () => {
    const node = organizationJsonLd({ baseUrl: BASE });
    expect(node['@type']).toBe('Organization');
    expect(node.name).toBe('Amazing Goats');
    expect(node.url).toBe(`${BASE}/`);
    const areas = node.areaServed as Record<string, unknown>[];
    expect(areas[0].name).toBe('KwaZulu-Natal');
    expect(areas[0].containedInPlace).toEqual({ '@type': 'Country', name: 'South Africa' });
  });

  it('omits a contact point when no email or phone is configured', () => {
    const node = organizationJsonLd({ baseUrl: BASE });
    expect(node).not.toHaveProperty('contactPoint');
    expect(serializeJsonLd(node)).not.toContain('null');
  });

  it('includes only the contact details it was given', () => {
    const node = organizationJsonLd({ baseUrl: BASE, email: 'hello@example.co.za' });
    const point = (node.contactPoint as Record<string, unknown>[])[0];
    expect(point.email).toBe('hello@example.co.za');
    expect(point).not.toHaveProperty('telephone');
  });

  it('is Organization, not LocalBusiness, while no street address is published', () => {
    const node = organizationJsonLd({ baseUrl: BASE });
    expect(node['@type']).not.toBe('LocalBusiness');
    expect(node).not.toHaveProperty('address');
  });
});

describe('faqJsonLd', () => {
  it('wraps each question in a Question with an accepted Answer', () => {
    const node = faqJsonLd([{ question: 'Do you deliver to Durban?', answer: 'Yes, weekly.' }])!;
    const q = (node.mainEntity as Record<string, unknown>[])[0];
    expect(q['@type']).toBe('Question');
    expect(q.acceptedAnswer).toEqual({ '@type': 'Answer', text: 'Yes, weekly.' });
  });

  it('returns nothing when every entry is blank', () => {
    expect(faqJsonLd([{ question: '  ', answer: '' }])).toBeUndefined();
    expect(faqJsonLd([])).toBeUndefined();
  });

  it('drops a blank answer rather than emitting a malformed question', () => {
    const node = faqJsonLd([
      { question: 'Real question', answer: 'Real answer' },
      { question: 'No answer', answer: '   ' },
    ])!;
    expect((node.mainEntity as unknown[]).length).toBe(1);
  });
});

describe('articleJsonLd', () => {
  it('carries the headline, dates and publisher', () => {
    const node = articleJsonLd({
      headline: 'Where to buy lamb in Durban',
      url: `${BASE}/guides/where-to-buy-lamb-durban`,
      description: 'A guide.',
      datePublished: '2026-11-01',
      section: 'guide',
    });
    expect(node['@type']).toBe('Article');
    expect(node.dateModified).toBe('2026-11-01');
    expect((node.publisher as Record<string, unknown>).name).toBe('Amazing Goats');
  });
});

describe('isoDuration', () => {
  it('formats minutes as an ISO 8601 duration', () => {
    expect(isoDuration(0)).toBe('PT0M');
    expect(isoDuration(30)).toBe('PT30M');
    expect(isoDuration(60)).toBe('PT1H');
    expect(isoDuration(90)).toBe('PT1H30M');
    expect(isoDuration(210)).toBe('PT3H30M');
  });
});

describe('recipeJsonLd', () => {
  const node = recipeJsonLd({
    name: 'Lamb potjie',
    url: `${BASE}/recipes/lamb-potjie`,
    description: 'A slow potjie.',
    servings: 4,
    prepMinutes: 30,
    cookMinutes: 180,
    ingredients: ['1.5 kg lamb neck', '2 onions'],
    steps: ['Brown the meat.', 'Simmer for three hours.'],
    category: 'potjie',
    datePublished: '2026-11-10',
  });

  it('states yield, times and totals', () => {
    expect(node.recipeYield).toBe('4 servings');
    expect(node.prepTime).toBe('PT30M');
    expect(node.cookTime).toBe('PT3H');
    expect(node.totalTime).toBe('PT3H30M');
  });

  it('carries ingredients as strings and steps as HowToStep', () => {
    expect(node.recipeIngredient).toEqual(['1.5 kg lamb neck', '2 onions']);
    const steps = node.recipeInstructions as Record<string, unknown>[];
    expect(steps[0]).toEqual({ '@type': 'HowToStep', text: 'Brown the meat.' });
  });

  it('keeps every ingredient and step the page renders', () => {
    expect((node.recipeIngredient as string[]).length).toBe(2);
    expect((node.recipeInstructions as unknown[]).length).toBe(2);
  });
});
