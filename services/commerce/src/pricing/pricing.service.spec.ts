import { describe, it, expect } from 'vitest';
import { PricingService } from './pricing.service';
import { InMemoryPricingStore } from './pricing.store';
import { PriceList } from './pricing.types';

const AT = new Date('2026-06-01T10:00:00.000Z');

function draft(over: Partial<PriceList> = {}): PriceList {
  return {
    id: 'pl_new',
    code: 'public-2027',
    name: 'Public 2027',
    audience: 'public',
    validFrom: '2026-06-01T00:00:00.000Z',
    validTo: null,
    status: 'draft',
    items: [{ sku: 'AG-LB-005', priceExVatCents: 29000, unitPriceBasis: 'kg' }],
    ...over,
  };
}

const svc = (seed: PriceList[] = []) => new PricingService(new InMemoryPricingStore(seed));

describe('PricingService', () => {
  it('starts empty', async () => {
    expect(await svc().list()).toEqual([]);
  });

  it('creates a list as a draft and refuses a duplicate code', async () => {
    const s = svc();
    const created = await s.create(draft());
    expect(created.status).toBe('draft');
    await expect(s.create(draft({ id: 'pl_other' }))).rejects.toThrow(/already exists/);
  });

  it('runs draft -> submit -> approve, with two people', async () => {
    const s = svc();
    await s.create(draft());
    const submitted = await s.submit('pl_new', 'user_a');
    expect(submitted.status).toBe('pending_approval');
    await expect(s.approve('pl_new', 'user_a', AT)).rejects.toThrow(/second approver/);
    const published = await s.approve('pl_new', 'user_b', AT);
    expect(published.status).toBe('published');
    expect(published.approvedBy).toBe('user_b');
  });

  it('supersedes the previous live list when a new one is published', async () => {
    const old: PriceList = { ...draft({ id: 'pl_old', code: 'public-2026' }), status: 'published' };
    const s = svc([old]);
    await s.create(draft());
    await s.submit('pl_new', 'user_a');
    await s.approve('pl_new', 'user_b', AT);

    const active = await s.activeFor('public', AT);
    expect(active?.id).toBe('pl_new');
    expect((await s.get('pl_old')).status).toBe('superseded');
  });

  it('prices a SKU for an audience', async () => {
    const live: PriceList = { ...draft(), status: 'published' };
    const s = svc([live]);
    const price = await s.priceFor('public', 'AG-LB-005', AT);
    expect(price?.priceExVatCents).toBe(29000);
    expect(price?.priceIncVatCents).toBe(33350);
  });

  it('is null for an unknown SKU or a quiet audience', async () => {
    const live: PriceList = { ...draft(), status: 'published' };
    const s = svc([live]);
    expect(await s.priceFor('public', 'AG-XX-999', AT)).toBeNull();
    expect(await s.priceFor('bakery', 'AG-LB-005', AT)).toBeNull();
  });

  it('prices many SKUs from the same list version', async () => {
    const live: PriceList = {
      ...draft(),
      status: 'published',
      items: [
        { sku: 'AG-LB-005', priceExVatCents: 29000, unitPriceBasis: 'kg' },
        { sku: 'AG-EG-001', priceExVatCents: 5000, unitPriceBasis: 'dozen' },
      ],
    };
    const prices = await svc([live]).priceMany('public', ['AG-LB-005', 'AG-EG-001', 'AG-XX-999'], AT);
    expect(Object.keys(prices).sort()).toEqual(['AG-EG-001', 'AG-LB-005']);
  });

  it('404s for an unknown list', async () => {
    await expect(svc().get('nope')).rejects.toThrow(/unknown price list/);
  });
});
