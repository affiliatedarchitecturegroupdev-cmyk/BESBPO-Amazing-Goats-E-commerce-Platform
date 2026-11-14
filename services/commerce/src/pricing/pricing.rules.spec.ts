import { describe, it, expect } from 'vitest';
import {
  PricingError,
  activeListFor,
  isActive,
  itemFor,
  publish,
  resolvePrice,
  resolvePrices,
  submitForApproval,
  supersedeOthers,
} from './pricing.rules';
import { PriceList } from './pricing.types';

const AT = new Date('2026-06-01T10:00:00.000Z');

function list(over: Partial<PriceList> = {}): PriceList {
  return {
    id: 'pl_1',
    code: 'public-2026',
    name: 'Public 2026',
    audience: 'public',
    validFrom: '2026-01-01T00:00:00.000Z',
    validTo: null,
    status: 'published',
    items: [
      { sku: 'AG-LB-005', priceExVatCents: 27500, unitPriceBasis: 'kg' },
      { sku: 'AG-EG-001', priceExVatCents: 4500, unitPriceBasis: 'dozen' },
    ],
    ...over,
  };
}

describe('isActive', () => {
  it('is live only when published and inside its window', () => {
    expect(isActive(list(), AT)).toBe(true);
    expect(isActive(list({ status: 'draft' }), AT)).toBe(false);
    expect(isActive(list({ status: 'superseded' }), AT)).toBe(false);
    expect(isActive(list({ validFrom: '2026-07-01T00:00:00.000Z' }), AT)).toBe(false);
    expect(isActive(list({ validTo: '2026-05-01T00:00:00.000Z' }), AT)).toBe(false);
  });

  it('treats validTo as exclusive', () => {
    const boundary = new Date('2026-06-01T10:00:00.000Z');
    expect(isActive(list({ validTo: boundary.toISOString() }), boundary)).toBe(false);
    expect(isActive(list({ validTo: boundary.toISOString() }), new Date(boundary.getTime() - 1))).toBe(true);
  });
});

describe('activeListFor', () => {
  it('picks the most recently started live list for the audience', () => {
    const older = list({ id: 'pl_old', code: 'public-2025', validFrom: '2025-01-01T00:00:00.000Z' });
    const newer = list({ id: 'pl_new', code: 'public-2026', validFrom: '2026-01-01T00:00:00.000Z' });
    expect(activeListFor([older, newer], 'public', AT)?.id).toBe('pl_new');
    expect(activeListFor([newer, older], 'public', AT)?.id).toBe('pl_new');
  });

  it('returns null when the audience has no live list', () => {
    expect(activeListFor([list({ audience: 'trader' })], 'public', AT)).toBeNull();
    expect(activeListFor([], 'bakery', AT)).toBeNull();
  });
});

describe('resolvePrice', () => {
  it('returns the price with a VAT breakdown', () => {
    const p = resolvePrice([list()], 'public', 'AG-LB-005', AT);
    expect(p).toEqual({
      sku: 'AG-LB-005',
      priceListCode: 'public-2026',
      audience: 'public',
      priceExVatCents: 27500,
      vatCents: 4125,
      priceIncVatCents: 31625,
      unitPriceBasis: 'kg',
    });
  });

  it('is null when no live list carries the SKU', () => {
    expect(resolvePrice([list()], 'public', 'AG-XX-999', AT)).toBeNull();
    expect(resolvePrice([list({ status: 'draft' })], 'public', 'AG-LB-005', AT)).toBeNull();
  });

  it('honours a zero rate for zero-rated goods', () => {
    const p = resolvePrice([list()], 'public', 'AG-EG-001', AT, 0);
    expect(p?.vatCents).toBe(0);
    expect(p?.priceIncVatCents).toBe(4500);
  });
});

describe('resolvePrices', () => {
  it('resolves many SKUs and omits the ones the live list lacks', () => {
    const prices = resolvePrices([list()], 'public', ['AG-LB-005', 'AG-EG-001', 'AG-XX-999'], AT);
    expect(Object.keys(prices).sort()).toEqual(['AG-EG-001', 'AG-LB-005']);
    expect(prices['AG-EG-001'].priceExVatCents).toBe(4500);
  });
});

describe('itemFor', () => {
  it('finds an item or returns null', () => {
    expect(itemFor(list(), 'AG-LB-005')?.priceExVatCents).toBe(27500);
    expect(itemFor(list(), 'AG-XX-999')).toBeNull();
  });
});

describe('submitForApproval', () => {
  it('moves a draft to pending and records the requester', () => {
    const submitted = submitForApproval(list({ status: 'draft' }), 'user_a');
    expect(submitted.status).toBe('pending_approval');
    expect(submitted.requestedBy).toBe('user_a');
  });

  it('refuses a non-draft', () => {
    expect(() => submitForApproval(list(), 'user_a')).toThrow(PricingError);
  });

  it('refuses an empty list', () => {
    expect(() => submitForApproval(list({ status: 'draft', items: [] }), 'user_a')).toThrow(/empty/);
  });

  it('rejects a price that is not a whole number of cents', () => {
    const bad = list({ status: 'draft', items: [{ sku: 'AG-LB-005', priceExVatCents: 275.5, unitPriceBasis: 'kg' }] });
    expect(() => submitForApproval(bad, 'user_a')).toThrow(/integer/);
  });

  it('rejects a negative price', () => {
    const bad = list({ status: 'draft', items: [{ sku: 'AG-LB-005', priceExVatCents: -1, unitPriceBasis: 'kg' }] });
    expect(() => submitForApproval(bad, 'user_a')).toThrow(/non-negative/);
  });
});

describe('publish (two-person approval)', () => {
  const pending = () => submitForApproval(list({ status: 'draft' }), 'user_a');

  it('publishes when a second person approves', () => {
    const published = publish(pending(), 'user_b', AT);
    expect(published.status).toBe('published');
    expect(published.approvedBy).toBe('user_b');
    expect(published.publishedAt).toBe(AT.toISOString());
  });

  it('refuses when the approver is the requester (four-eyes)', () => {
    expect(() => publish(pending(), 'user_a', AT)).toThrow(/second approver/);
  });

  it('refuses a list that was not submitted', () => {
    expect(() => publish(list({ status: 'draft' }), 'user_b', AT)).toThrow(/submitted/);
  });
});

describe('supersedeOthers', () => {
  it('supersedes other published lists for the same audience only', () => {
    const live = list({ id: 'pl_old', code: 'public-2025' });
    const other = list({ id: 'pl_trade', code: 'trader-2025', audience: 'trader' });
    const published = list({ id: 'pl_new', code: 'public-2026', status: 'published' });
    const result = supersedeOthers([live, other, published], published);
    const byId = Object.fromEntries(result.map((l) => [l.id, l.status]));
    expect(byId).toEqual({ pl_old: 'superseded', pl_trade: 'published', pl_new: 'published' });
  });
});
