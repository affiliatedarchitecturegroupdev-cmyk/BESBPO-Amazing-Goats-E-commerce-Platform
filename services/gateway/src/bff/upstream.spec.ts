import { describe, it, expect } from 'vitest';
import {
  TtlCache,
  coerceItems,
  isOrderOpen,
  readUpstreamsFromEnv,
  toCatalogueItem,
  visibleTo,
} from './upstream';

describe('readUpstreamsFromEnv', () => {
  it('falls back to local ports', () => {
    const u = readUpstreamsFromEnv({});
    expect(u.commerce).toBe('http://localhost:3001');
    expect(u.identity).toBe('http://localhost:3009');
  });
  it('honours explicit URLs', () => {
    const u = readUpstreamsFromEnv({ COMMERCE_URL: 'http://commerce:8080', IDENTITY_URL: 'http://id:9000' });
    expect(u.commerce).toBe('http://commerce:8080');
    expect(u.identity).toBe('http://id:9000');
  });
});

describe('visibleTo', () => {
  it('shows both-channel items to everyone', () => {
    expect(visibleTo('both', 'public')).toBe(true);
    expect(visibleTo('both', 'trade')).toBe(true);
  });
  it('keeps public-only and trade-only items apart', () => {
    expect(visibleTo('public_only', 'public')).toBe(true);
    expect(visibleTo('public_only', 'trade')).toBe(false);
    expect(visibleTo('trade_only', 'trade')).toBe(true);
    expect(visibleTo('trade_only', 'public')).toBe(false);
  });
});

describe('toCatalogueItem', () => {
  it('normalises a well-formed record', () => {
    const v = toCatalogueItem({
      sku: 'AG-LG-001', productId: 'p1', name: 'Boer kid, female', pack: '1.2 to 1.6 kg',
      unit: 'each', fulfilment: 'reservation', temperature: 'live', channel: 'both', phase: 1, priceCents: 250000,
    });
    expect(v).toMatchObject({ sku: 'AG-LG-001', fulfilment: 'reservation', temperature: 'live', phase: 1, priceCents: 250000 });
  });
  it('rejects records without a usable SKU', () => {
    expect(toCatalogueItem(null)).toBeNull();
    expect(toCatalogueItem({ name: 'x' })).toBeNull();
    expect(toCatalogueItem({ sku: '  ' })).toBeNull();
  });
  it('defaults unknown enum values instead of passing them through', () => {
    const v = toCatalogueItem({ sku: 'AG-X-1', fulfilment: 'bogus', temperature: 'lukewarm', channel: 'secret', phase: 9 });
    expect(v).toMatchObject({ fulfilment: 'in_stock', temperature: 'ambient', channel: 'both', phase: 1 });
  });
});

describe('coerceItems', () => {
  it('accepts an array or an {items} envelope', () => {
    expect(coerceItems([{ sku: 'A' }])).toHaveLength(1);
    expect(coerceItems({ items: [{ sku: 'A' }, { sku: 'B' }] })).toHaveLength(2);
  });
  it('drops junk entries', () => {
    expect(coerceItems([{ sku: 'A' }, { nope: 1 }, 42])).toHaveLength(1);
    expect(coerceItems('nonsense')).toEqual([]);
  });
});

describe('isOrderOpen', () => {
  const now = Date.parse('2026-03-08T10:00:00Z');
  it('public closes at the cut-off, trade at the trade lock', () => {
    const cutoffAt = '2026-03-08T15:00:00Z';
    const tradeLockAt = '2026-03-08T09:00:00Z';
    expect(isOrderOpen('public', cutoffAt, tradeLockAt, now)).toBe(true);
    expect(isOrderOpen('trade', cutoffAt, tradeLockAt, now)).toBe(false);
  });
  it('treats missing or invalid dates as open', () => {
    expect(isOrderOpen('public', undefined, undefined, now)).toBe(true);
    expect(isOrderOpen('trade', 'not-a-date', undefined, now)).toBe(true);
  });
});

describe('TtlCache', () => {
  it('serves within the TTL and expires after it', () => {
    let t = 1000;
    const cache = new TtlCache<string>(500, () => t);
    cache.set('k', 'v');
    expect(cache.get('k')).toBe('v');
    t = 1400;
    expect(cache.get('k')).toBe('v');
    t = 1600;
    expect(cache.get('k')).toBeUndefined();
  });
});
