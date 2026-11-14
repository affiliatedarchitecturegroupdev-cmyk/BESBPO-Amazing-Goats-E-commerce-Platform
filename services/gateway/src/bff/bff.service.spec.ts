import { describe, it, expect } from 'vitest';
import { BffService, UpstreamError, aggregateOpenApi, viewForRoles } from './bff.service';
import { FetchLike, Upstreams } from './upstream';

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
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }, calls));
    await svc.catalogue('public');
    await svc.catalogue('public');
    expect(calls).toHaveLength(1);
  });
});

describe('BffService.home', () => {
  it('combines the catalogue with the current cycle and computes orderOpen', async () => {
    const future = new Date(Date.now() + 3600_000).toISOString();
    const svc = new BffService(
      COMMERCE_ONLY,
      stubFetch({ '/commerce/catalog': CATALOGUE, '/commerce/cycles/current': { cutoffAt: future, tradeLockAt: future } }),
    );
    const res = await svc.home('public');
    expect(res.cycle.orderOpen).toBe(true);
    expect(res.sections[0].items.length).toBeGreaterThan(0);
  });

  it('still returns the catalogue when the cycle service is down', async () => {
    const svc = new BffService(COMMERCE_ONLY, stubFetch({ '/commerce/catalog': CATALOGUE }));
    const res = await svc.home('public');
    expect(res.cycle.cutoffAt).toBeNull();
    expect(res.sections[0].items).toHaveLength(2);
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
    expect(Object.keys(doc.paths as object)).toEqual(['/catalog']);
  });
});
