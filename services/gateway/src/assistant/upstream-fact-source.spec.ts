import { describe, expect, it } from 'vitest';
import {
  UpstreamFactSource,
  toCatalogueRow,
  toContentRow,
  toZoneRow,
} from './upstream-fact-source';
import type { FetchLike, Upstreams } from '../bff/upstream';

const upstreams: Upstreams = { commerce: 'http://commerce', logistics: 'http://logistics' };

/** A fetch that answers each URL from a table, so a test states its upstream. */
function fetchFor(routes: Record<string, unknown>): FetchLike {
  return async (url) => {
    const body = routes[url];
    if (body === undefined) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, status: 200, json: async () => body };
  };
}

describe('UpstreamFactSource', () => {
  it('reads the catalogue the BFF already proxies', async () => {
    const source = new UpstreamFactSource(
      upstreams,
      fetchFor({ 'http://commerce/commerce/catalog': { items: [{ sku: 'AG-LM-002', name: 'Lamb', priceCents: 20900 }] } }),
    );
    const rows = await source.catalogue();
    expect(rows).toHaveLength(1);
    expect(rows[0].priceCents).toBe(20900);
  });

  it('accepts a bare array as well as an items wrapper', async () => {
    const source = new UpstreamFactSource(
      upstreams,
      fetchFor({ 'http://commerce/commerce/catalog': [{ sku: 'AG-LM-002', name: 'Lamb' }] }),
    );
    await expect(source.catalogue()).resolves.toHaveLength(1);
  });

  it('reads the current cycle', async () => {
    const source = new UpstreamFactSource(
      upstreams,
      fetchFor({ 'http://commerce/commerce/cycles/current': { cutoffAt: '2026-11-15T15:00:00.000Z' } }),
    );
    const cycle = await source.cycle();
    expect(cycle?.cutoffAt).toBe('2026-11-15T15:00:00.000Z');
  });

  it('reads delivery zones from logistics', async () => {
    const source = new UpstreamFactSource(
      upstreams,
      fetchFor({ 'http://logistics/logistics/zones': [{ code: 'ballito', feeCents: 6500 }] }),
    );
    const zones = await source.zones();
    expect(zones[0].code).toBe('ballito');
  });

  it('reads published content from commerce', async () => {
    const source = new UpstreamFactSource(
      upstreams,
      fetchFor({ 'http://commerce/commerce/content': { items: [{ slug: 'braai-lamb', kind: 'post', title: 'Braai' }] } }),
    );
    const content = await source.content();
    expect(content[0].slug).toBe('braai-lamb');
  });

  it('returns nothing rather than throwing when an upstream fails', async () => {
    const source = new UpstreamFactSource(upstreams, async () => {
      throw new Error('connection refused');
    });
    await expect(source.catalogue()).resolves.toEqual([]);
    await expect(source.zones()).resolves.toEqual([]);
    await expect(source.content()).resolves.toEqual([]);
    await expect(source.cycle()).resolves.toBeUndefined();
  });

  it('returns nothing when an upstream is not configured', async () => {
    const source = new UpstreamFactSource({} as Upstreams, fetchFor({}));
    await expect(source.catalogue()).resolves.toEqual([]);
  });

  it('forwards the caller token, so row-level security still applies upstream', async () => {
    let seen: Record<string, string> | undefined;
    const source = new UpstreamFactSource(upstreams, async (_url, init) => {
      seen = init?.headers;
      return { ok: true, status: 200, json: async () => [] };
    });
    await source.catalogue('Bearer abc');
    expect(seen?.authorization).toBe('Bearer abc');
  });
});

describe('toCatalogueRow', () => {
  it('keeps a price that is present and drops one that is not', () => {
    expect(toCatalogueRow({ sku: 'A', priceCents: 100 })?.priceCents).toBe(100);
    expect(toCatalogueRow({ sku: 'A' })?.priceCents).toBeUndefined();
  });

  it('rejects a row with no SKU', () => {
    expect(toCatalogueRow({ name: 'Nameless' })).toBeNull();
    expect(toCatalogueRow(null)).toBeNull();
  });
});

describe('toZoneRow', () => {
  it('keeps the optional money fields only when present', () => {
    const zone = toZoneRow({ code: 'ballito', feeCents: 6500 });
    expect(zone?.feeCents).toBe(6500);
    expect(zone?.minOrderCents).toBeUndefined();
  });

  it('rejects a row with no code', () => {
    expect(toZoneRow({ name: 'Ballito' })).toBeNull();
  });

  it('filters non-string route days', () => {
    expect(toZoneRow({ code: 'x', days: ['Monday', 3, null] })?.days).toEqual(['Monday']);
  });
});

describe('toContentRow', () => {
  it('rejects a row with no slug', () => {
    expect(toContentRow({ title: 'No slug' })).toBeNull();
  });

  it('defaults the kind to post', () => {
    expect(toContentRow({ slug: 's', title: 't' })?.kind).toBe('post');
  });
});
