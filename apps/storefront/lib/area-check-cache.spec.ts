import { describe, it, expect, vi } from 'vitest';
import type { AreaCheck } from '@ag/api-client';
import { AREA_CACHE_TTL_MS, AreaCheckCache, areaCacheKey, isAskable } from './area-check-cache';

const served: AreaCheck = {
  served: true,
  zone: { id: 2, code: 'KZN-DBN', name: 'Durban' },
  nextSlot: '2026-11-18T04:00:00.000Z',
  feeCents: 9000,
  cutoffAt: '2026-11-15T15:00:00.000Z',
  feeIncludesVat: true,
  freeOverApplied: false,
};

const unserved: AreaCheck = { served: false, area: 'kimberley', needsArea: false, waitlist: { available: true } };

describe('the cache key', () => {
  it('treats case, padding and punctuation as one area', () => {
    expect(areaCacheKey({ suburb: ' Umhlanga ' })).toBe(areaCacheKey({ suburb: 'UMHLANGA' }));
    expect(areaCacheKey({ postalCode: ' 4051 ' })).toBe(areaCacheKey({ postalCode: '40-51' }));
  });

  it('separates a different area, and a different goods total', () => {
    expect(areaCacheKey({ suburb: 'Durban' })).not.toBe(areaCacheKey({ suburb: 'Umhlanga' }));
    expect(areaCacheKey({ suburb: 'Durban', goodsTotalCents: 100 })).not.toBe(
      areaCacheKey({ suburb: 'Durban', goodsTotalCents: 200 }),
    );
  });
});

describe('whether a query is worth asking', () => {
  it('asks for a postal code, or a suburb of two or more characters', () => {
    expect(isAskable({ postalCode: '4051' })).toBe(true);
    expect(isAskable({ suburb: 'Um' })).toBe(true);
  });

  it('does not ask for an empty area or a single keystroke', () => {
    expect(isAskable({})).toBe(false);
    expect(isAskable({ suburb: 'U' })).toBe(false);
    expect(isAskable({ postalCode: 'ab' })).toBe(false);
    expect(isAskable({ suburb: '   ' })).toBe(false);
  });
});

describe('AreaCheckCache', () => {
  it('answers a repeated query from the cache, without a second call', async () => {
    const cache = new AreaCheckCache();
    const fetchCheck = vi.fn(async () => served);

    await cache.resolve({ suburb: 'Durban' }, fetchCheck);
    await cache.resolve({ suburb: 'Durban' }, fetchCheck);

    expect(fetchCheck).toHaveBeenCalledTimes(1);
  });

  it('does call again for a different area', async () => {
    const cache = new AreaCheckCache();
    const fetchCheck = vi.fn(async () => served);
    await cache.resolve({ suburb: 'Durban' }, fetchCheck);
    await cache.resolve({ suburb: 'Umhlanga' }, fetchCheck);
    expect(fetchCheck).toHaveBeenCalledTimes(2);
  });

  it('expires an answer after the TTL', async () => {
    let now = 1_000_000;
    const cache = new AreaCheckCache(60_000, () => now);
    const fetchCheck = vi.fn(async () => served);

    await cache.resolve({ suburb: 'Durban' }, fetchCheck);
    now += 59_999;
    await cache.resolve({ suburb: 'Durban' }, fetchCheck);
    expect(fetchCheck).toHaveBeenCalledTimes(1);

    now += 1;
    await cache.resolve({ suburb: 'Durban' }, fetchCheck);
    expect(fetchCheck).toHaveBeenCalledTimes(2);
  });

  it('caches a refusal too, so an unserved area does not re-ask per keystroke', async () => {
    const cache = new AreaCheckCache();
    const fetchCheck = vi.fn(async () => unserved);
    await cache.resolve({ suburb: 'Kimberley' }, fetchCheck);
    await cache.resolve({ suburb: 'Kimberley' }, fetchCheck);
    expect(fetchCheck).toHaveBeenCalledTimes(1);
  });

  it('forgets an entry on request, and drops it once expired', () => {
    let now = 0;
    const cache = new AreaCheckCache(1000, () => now);
    cache.set({ suburb: 'Durban' }, served);
    expect(cache.get({ suburb: 'Durban' })).toEqual(served);

    cache.forget({ suburb: 'Durban' });
    expect(cache.get({ suburb: 'Durban' })).toBeUndefined();

    cache.set({ suburb: 'Durban' }, served);
    now = 1000;
    expect(cache.get({ suburb: 'Durban' })).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('defaults to a short TTL, because a fee and a slot both move', () => {
    expect(AREA_CACHE_TTL_MS).toBe(5 * 60 * 1000);
  });
});
