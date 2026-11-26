import { describe, it, expect } from 'vitest';
import { BffService, UpstreamError, aggregateOpenApi, viewForRoles } from './bff.service';
import { FetchLike, Upstreams, coerceSections, merchPageFrom, visibleSections } from './upstream';

/** A fetch stand-in that serves canned JSON per URL and records what was requested. */
function stubFetch(routes: Record<string, unknown>, calls: string[] = []): FetchLike {
  return async (url) => {
    calls.push(url);
    const key = Object.keys(routes).find((r) => url.endsWith(r));
    if (key === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => routes[key] };
  };
}

const COMMERCE_ONLY: Upstreams = { commerce: 'http://commerce' };

const CATALOGUE = {
  items: [
    { sku: 'AG-EG-001', name: 'Eggs, large', channel: 'both', fulfilment: 'pre_order_cycle', temperature: 'ambient', phase: 1 },
    { sku: 'AG-PK-001', name: 'Pork loin', channel: 'public_only', fulfilment: 'in_stock', temperature: 'chilled', phase: 1 },
    { sku: 'AG-BF-001', name: 'Beef carcass', channel: 'trade_only', fulfilment: 'quote', temperature: 'chilled', phase: 1 },
  ],
};

/** A resolved merchandising payload as the commerce service returns it. */
const MERCH = [
  {
    code: 'home-hero',
    title: 'This week',
    page: 'home',
    items: [
      { sku: 'AG-EG-001', name: 'Eggs, large', pack: '30', badge: 'special', item: { sku: 'AG-EG-001', name: 'Eggs, large', pack: '30', channel: 'both', fulfilment: 'pre_order_cycle', temperature: 'ambient', phase: 1 } },
      { sku: 'AG-BF-001', name: 'Beef carcass', pack: 'carcass', badge: null, item: { sku: 'AG-BF-001', name: 'Beef carcass', pack: 'carcass', channel: 'trade_only', fulfilment: 'quote', temperature: 'chilled', phase: 1 } },
    ],
  },
];

describe('viewForRoles', () => {
  it('gives trade roles the trade view and everyone else public', () => {
    expect(viewForRoles(['trade_owner'])).toBe('trade');
    expect(viewForRoles(['trade_buyer', 'sales'])).toBe('trade');
    expect(viewForRoles(['customer_household'])).toBe('public');
    expect(viewForRoles([])).toBe('public');
  });
});

describe('BffService.catalogue', () => {
  it('returns the public view: both + public_only', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }));
    const res = await svc.catalogue('public');
    expect(res.view).toBe('public');
    expect(res.items.map((v) => v.sku)).toEqual(['AG-EG-001', 'AG-PK-001']);
    expect(res.count).toBe(2);
  });

  it('returns the trade view: both + trade_only', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }));
    const res = await svc.catalogue('trade');
    expect(res.items.map((v) => v.sku)).toEqual(['AG-EG-001', 'AG-BF-001']);
  });

  it('forwards the caller authorization header upstream', async () => {
    const calls: string[] = [];
    let seenAuth: string | undefined;
    const fetchImpl: FetchLike = async (url, init) => {
      calls.push(url);
      seenAuth = init?.headers?.authorization;
      return { ok: true, status: 200, json: async () => CATALOGUE };
    };
    await new BffService(COMMERCE_ONLY, fetchImpl).catalogue('public', 'Bearer tok');
    expect(seenAuth).toBe('Bearer tok');
    expect(calls[0]).toBe('http://commerce/commerce/catalog');
  });

  it('surfaces an upstream failure as UpstreamError', async () => {
    const svc = new BffService(COMMERCE_ONLY, async () => ({ ok: false, status: 502, json: async () => ({}) }));
    await expect(svc.catalogue('public')).rejects.toBeInstanceOf(UpstreamError);
  });

  it('caches reads within the TTL', async () => {
    const calls: string[] = [];
    const svc = new BffService(
      COMMERCE_ONLY,
      stubFetch({
        '/commerce/catalog': CATALOGUE,
        '/commerce/pricing/prices?skus=AG-EG-001%2CAG-PK-001': {},
      }, calls),
    );
    await svc.catalogue('public');
    await svc.catalogue('public');
    // The catalogue and its one bulk price read are each cached, so the second
    // call adds nothing. A *failed* price read is deliberately not cached, so
    // the shop picks pricing back up as soon as it returns.
    expect(calls.filter((c) => c.includes('/commerce/catalog'))).toHaveLength(1);
    expect(calls.filter((c) => c.includes('/commerce/pricing/prices'))).toHaveLength(1);
  });
});

describe('BffService catalogue prices', () => {
  const PRICES = {
    'AG-EG-001': { sku: 'AG-EG-001', priceListCode: 'public-2026', audience: 'public', priceExVatCents: 4500, vatCents: 675, priceIncVatCents: 5175, unitPriceBasis: 'dozen' },
  };

  it('fills priceCents on the catalogue rows from the public price list', async () => {
    const svc = new BffService(
      COMMERCE_ONLY,
      stubFetch({ '/commerce/catalog': CATALOGUE, '/commerce/pricing/prices?skus=AG-EG-001%2CAG-PK-001': PRICES }),
    );
    const res = await svc.catalogue('public');
    const eggs = res.items.find((i) => i.sku === 'AG-EG-001');
    expect(eggs?.priceCents).toBe(4500);
    // A SKU the price list does not carry keeps no price rather than a zero.
    expect(res.items.find((i) => i.sku === 'AG-PK-001')?.priceCents).toBeUndefined();
  });

  it('asks for every visible SKU in one read', async () => {
    const calls: string[] = [];
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }, calls));
    await svc.catalogue('public');
    const priceCall = calls.find((c) => c.includes('/commerce/pricing/prices'));
    expect(priceCall).toContain('skus=AG-EG-001%2CAG-PK-001');
  });

  it('prices only what the view may see, not the hidden trade-only rows', async () => {
    const calls: string[] = [];
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }, calls));
    await svc.catalogue('public');
    const priceCall = calls.find((c) => c.includes('/commerce/pricing/prices'));
    expect(priceCall).not.toContain('AG-BF-001');
  });

  it('still renders the catalogue when the price read fails', async () => {
    // Pricing down must not empty the shop: the rows survive without a price.
    const svc = new BffService(
      COMMERCE_ONLY,
      stubFetch({ '/commerce/catalog': CATALOGUE }), // no prices route -> 404
    );
    const res = await svc.catalogue('public');
    expect(res.items.map((i) => i.sku)).toEqual(['AG-EG-001', 'AG-PK-001']);
    expect(res.items.every((i) => i.priceCents === undefined)).toBe(true);
  });

  it('ignores a malformed or negative price rather than rendering it', async () => {
    for (const bad of [{ priceExVatCents: '4500' }, { priceExVatCents: 12.5 }, { priceExVatCents: -1 }, {}]) {
      const svc = new BffService(
        COMMERCE_ONLY,
        stubFetch({
          '/commerce/catalog': CATALOGUE,
          '/commerce/pricing/prices?skus=AG-EG-001%2CAG-PK-001': { 'AG-EG-001': bad },
        }),
      );
      const res = await svc.catalogue('public');
      expect(res.items.find((i) => i.sku === 'AG-EG-001')?.priceCents).toBeUndefined();
    }
  });

  it('prices merchandising tiles on the home page too', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const svc = new BffService(
      COMMERCE_ONLY,
      stubFetch({
        '/commerce/catalog': CATALOGUE,
        '/commerce/cycles/current': { cutoffAt: future, tradeLockAt: future },
        '/commerce/merchandising/page?page=home': MERCH,
        '/commerce/pricing/prices?skus=AG-EG-001': PRICES,
      }),
    );
    const res = await svc.home('public');
    const eggs = res.sections[0].items.find((i) => i.sku === 'AG-EG-001');
    expect(eggs?.item.priceCents).toBe(4500);
  });
});

describe('BffService.home', () => {
  it('returns the curated sections, filtered to the view, with the cycle and orderOpen', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const svc = new BffService(
      COMMERCE_ONLY,
      stubFetch({
        '/commerce/catalog': CATALOGUE,
        '/commerce/cycles/current': { cutoffAt: future, tradeLockAt: future },
        '/commerce/merchandising/page?page=home': MERCH,
      }),
    );
    const res = await svc.home('public');
    expect(res.cycle.orderOpen).toBe(true);
    // The public view drops the trade-only tile but keeps the section.
    expect(res.sections).toHaveLength(1);
    expect(res.sections[0].code).toBe('home-hero');
    expect(res.sections[0].items.map((i) => i.sku)).toEqual(['AG-EG-001']);
  });

  it('keeps trade-only tiles for the trade view', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE, '/commerce/merchandising/page?page=home': MERCH }));
    const res = await svc.home('trade');
    expect(res.sections[0].items.map((i) => i.sku)).toEqual(['AG-EG-001', 'AG-BF-001']);
  });

  it('falls back to one catalogue section when there is no curated merchandising', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }));
    const res = await svc.home('public');
    expect(res.sections).toHaveLength(1);
    expect(res.sections[0].code).toBe('catalogue');
    expect(res.sections[0].items.map((i) => i.sku)).toEqual(['AG-EG-001', 'AG-PK-001']);
  });

  it('still returns the catalogue when the cycle service is down', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }));
    const res = await svc.home('public');
    expect(res.cycle.cutoffAt).toBeNull();
    expect(res.sections[0].items).toHaveLength(2);
  });
});

describe('BffService.merchandising', () => {
  it('asks commerce for the page and filters the tiles to the view', async () => {
    const calls: string[] = [];
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/merchandising/page?page=category': MERCH }, calls));
    const res = await svc.merchandising('category', 'public');
    expect(calls[0]).toBe('http://commerce/commerce/merchandising/page?page=category');
    expect(res.page).toBe('category');
    expect(res.sections[0].items).toHaveLength(1);
  });

  it('is an empty list, not an error, when merchandising is unavailable', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({}));
    const res = await svc.merchandising('home', 'public');
    expect(res.sections).toEqual([]);
  });
});

describe('coerceSections', () => {
  it('reads an array or a {sections} envelope and drops a codeless section', () => {
    expect(coerceSections(MERCH)[0].code).toBe('home-hero');
    expect(coerceSections({ sections: MERCH })[0].code).toBe('home-hero');
    expect(coerceSections([{ title: 'no code' }])).toEqual([]);
  });

  it('drops a tile with no usable item but keeps the section', () => {
    const sections = coerceSections([{ code: 'x', title: 'X', page: 'home', items: [{ sku: 'a' }, MERCH[0].items[0]] }]);
    expect(sections[0].items.map((i) => i.sku)).toEqual(['AG-EG-001']);
  });

  it('is an empty list for a malformed payload', () => {
    expect(coerceSections(null)).toEqual([]);
    expect(coerceSections({ nope: 1 })).toEqual([]);
  });
});

describe('visibleSections', () => {
  it('filters tiles by channel and drops a section left empty', () => {
    const sections = coerceSections(MERCH);
    expect(visibleSections(sections, 'public')[0].items).toHaveLength(1);
    const tradeOnly = coerceSections([{ code: 't', title: 'T', page: 'home', items: [MERCH[0].items[1]] }]);
    expect(visibleSections(tradeOnly, 'public')).toEqual([]);
    expect(visibleSections(tradeOnly, 'trade')).toHaveLength(1);
  });
});

describe('merchPageFrom', () => {
  it('accepts a known page and defaults anything else to home', () => {
    expect(merchPageFrom('shop')).toBe('shop');
    expect(merchPageFrom('nope')).toBe('home');
    expect(merchPageFrom(undefined)).toBe('home');
  });
});

describe('aggregateOpenApi', () => {
  it('unions paths, namespaces colliding schemas and tags each service', () => {
    const merged = aggregateOpenApi([
      { name: 'commerce', doc: { info: { title: 'Commerce' }, paths: { '/catalog': {} }, components: { schemas: { Variant: { a: 1 } } } } },
      { name: 'stock', doc: { info: { title: 'Stock' }, paths: { '/stock': {} }, components: { schemas: { Variant: { b: 2 }, Batch: {} } } } },
    ]);
    expect(Object.keys(merged.paths as object).sort()).toEqual(['/catalog', '/stock']);
    expect(Object.keys((merged.components as { schemas: object }).schemas).sort()).toEqual(['Batch', 'Variant', 'stock_Variant']);
    expect((merged.tags as { name: string }[]).map((t) => t.name)).toEqual(['commerce', 'stock']);
  });

  it('skips a service whose document is unavailable', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/openapi.json': { paths: { '/catalog': {} } } }));
    const doc = await svc.openapi();
    // The documented path, plus the proxy prefixes for the configured upstreams
    // (only `commerce` here), so the gateway advertises what it can forward.
    expect(Object.keys(doc.paths as object).sort()).toEqual(['/catalog', '/commerce/*']);
  });

  it('advertises the proxied prefixes even when a service has no document', async () => {
    const merged = aggregateOpenApi(
      [],
      [
        { prefix: '/commerce', upstream: 'commerce' },
        { prefix: '/accounts', upstream: 'accounts' },
      ],
    );
    expect(Object.keys(merged.paths as object).sort()).toEqual(['/accounts/*', '/commerce/*']);
    expect((merged.paths as Record<string, { get: { tags: string[] } }>)['/commerce/*'].get.tags).toEqual([
      'commerce',
    ]);
  });

  it('does not overwrite a real path a service already documents', async () => {
    const merged = aggregateOpenApi(
      [{ name: 'commerce', doc: { paths: { '/commerce/*': { get: { summary: 'real' } } } } }],
      [{ prefix: '/commerce', upstream: 'commerce' }],
    );
    expect((merged.paths as Record<string, { get: { summary: string } }>)['/commerce/*'].get.summary).toBe('real');
  });
});
