import { describe, it, expect } from 'vitest';
import { requiresSecondApprover } from '@ag/rbac';
import { MAX_PRICE_SKUS, PricingController, skusFrom } from './pricing.controller';
import { PricingService } from './pricing.service';
import { InMemoryPricingStore } from './pricing.store';
import { PriceList } from './pricing.types';

// The guard resolves the caller onto the request; the JWT and dev-shim paths
// are covered in @ag/nest-auth. Here we pass a resolved user directly.
const req = (id: string) => ({ user: { id, roles: ['executive'] } });

const draft = (over: Partial<PriceList> = {}): PriceList => ({
  id: 'pl_new',
  code: 'public-2027',
  name: 'Public 2027',
  audience: 'public',
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: null,
  status: 'draft',
  items: [{ sku: 'AG-LB-005', priceExVatCents: 29000, unitPriceBasis: 'kg' }],
  ...over,
});

const controller = (seed: PriceList[] = []) =>
  new PricingController(new PricingService(new InMemoryPricingStore(seed)));

describe('PricingController', () => {
  it('submits with the requester taken from the request', async () => {
    const ctl = controller();
    await ctl.create(draft());
    const submitted = await ctl.submit('pl_new', req('user_a'));
    expect(submitted.status).toBe('pending_approval');
    expect(submitted.requestedBy).toBe('user_a');
  });

  it('refuses to publish when the same person approves', async () => {
    const ctl = controller();
    await ctl.create(draft());
    await ctl.submit('pl_new', req('user_a'));
    await expect(ctl.approve('pl_new', req('user_a'))).rejects.toThrow(/second approver/);
  });

  it('publishes when a second person approves', async () => {
    const ctl = controller();
    await ctl.create(draft());
    await ctl.submit('pl_new', req('user_a'));
    const published = await ctl.approve('pl_new', req('user_b'));
    expect(published.status).toBe('published');
    expect(published.approvedBy).toBe('user_b');
  });

  it('defaults the audience to public for the price lookup', async () => {
    const live = { ...draft(), status: 'published' as const };
    const price = await controller([live]).price({ sku: 'AG-LB-005' }, {});
    expect(price?.audience).toBe('public');
  });

  it('ignores an unknown audience and falls back to public', async () => {
    const live = { ...draft(), status: 'published' as const };
    const price = await controller([live]).price({ sku: 'AG-LB-005', audience: 'nonsense' }, {});
    expect(price?.audience).toBe('public');
  });

  it('serves the public price to a caller with no session', async () => {
    // The storefront is browsed before it is joined (T-082): no user, no token.
    const live = { ...draft(), status: 'published' as const };
    const price = await controller([live]).price({ sku: 'AG-LB-005', audience: 'public' }, {});
    expect(price?.priceExVatCents).toBe(29000);
  });

  it('refuses a trade audience to a caller without pricing:read', async () => {
    const live = { ...draft(), status: 'published' as const };
    const anonymous = controller([live]);
    expect(() => anonymous.price({ sku: 'AG-LB-005', audience: 'trader' }, {})).toThrow(
      /requires pricing:read/,
    );
    expect(() => anonymous.active({ audience: 'trade_a' }, {})).toThrow(/requires pricing:read/);
  });

  it('lets a customer session read the public audience but not a trade one', async () => {
    const live = { ...draft(), status: 'published' as const };
    const ctl = controller([live]);
    const customer = { user: { id: 'user_c', roles: ['customer_household'] } };
    expect((await ctl.price({ sku: 'AG-LB-005' }, customer))?.audience).toBe('public');
    expect(() => ctl.price({ sku: 'AG-LB-005', audience: 'bakery' }, customer)).toThrow(
      /requires pricing:read/,
    );
  });

  it('lets a pricing reader ask for a trade audience', async () => {
    const trader = { ...draft({ id: 'pl_trader', audience: 'trader' as const }), status: 'published' as const };
    const price = await controller([trader]).price({ sku: 'AG-LB-005', audience: 'trader' }, req('user_s'));
    expect(price?.audience).toBe('trader');
  });

  it('keeps the four-eyes rule aligned with the RBAC two-person list', () => {
    // If pricing:approve is ever removed from TWO_PERSON, this fails and the
    // publish guard must be revisited together with the RBAC matrix.
    expect(requiresSecondApprover('pricing:approve')).toBe(true);
  });

  describe('bulk prices', () => {
    const live = () =>
      draft({
        status: 'published',
        items: [
          { sku: 'AG-LB-005', priceExVatCents: 29000, unitPriceBasis: 'kg' },
          { sku: 'AG-EG-001', priceExVatCents: 4500, unitPriceBasis: 'dozen' },
        ],
      });

    it('prices many SKUs for an anonymous shopper in one read', async () => {
      const prices = await controller([live()]).prices({ skus: 'AG-LB-005,AG-EG-001' }, {});
      expect(prices['AG-LB-005'].priceExVatCents).toBe(29000);
      expect(prices['AG-EG-001'].priceExVatCents).toBe(4500);
      expect(prices['AG-LB-005'].audience).toBe('public');
    });

    it('omits SKUs the live list does not carry', async () => {
      const prices = await controller([live()]).prices({ skus: 'AG-LB-005,AG-XX-999' }, {});
      expect(Object.keys(prices)).toEqual(['AG-LB-005']);
    });

    it('serves a draft price to nobody', async () => {
      // A price list only exists for shoppers once it is published; a draft must
      // not leak through the bulk read either.
      const prices = await controller([draft()]).prices({ skus: 'AG-LB-005' }, {});
      expect(prices).toEqual({});
    });

    it('refuses a trade audience to a caller without pricing:read', async () => {
      const ctl = controller([live()]);
      expect(() => ctl.prices({ skus: 'AG-LB-005', audience: 'trader' }, {})).toThrow(
        /requires pricing:read/,
      );
    });

    it('lets a pricing reader ask for a trade audience', async () => {
      const trader = { ...draft({ id: 'pl_trader', audience: 'trader' as const }), status: 'published' as const };
      const prices = await controller([trader]).prices({ skus: 'AG-LB-005', audience: 'trader' }, req('user_s'));
      expect(prices['AG-LB-005'].audience).toBe('trader');
    });

    it('returns nothing for an empty or missing sku list', async () => {
      const ctl = controller([live()]);
      expect(await ctl.prices({}, {})).toEqual({});
      expect(await ctl.prices({ skus: '' }, {})).toEqual({});
      expect(await ctl.prices({ skus: ',,,' }, {})).toEqual({});
    });
  });

  describe('skusFrom', () => {
    it('trims, drops blanks and removes duplicates', () => {
      expect(skusFrom(' AG-LB-005 , AG-EG-001 ,,AG-LB-005 ')).toEqual(['AG-LB-005', 'AG-EG-001']);
    });

    it('ignores a non-string param', () => {
      expect(skusFrom(undefined)).toEqual([]);
      expect(skusFrom(['AG-LB-005'])).toEqual([]);
    });

    it('caps the list so one anonymous request cannot price the whole catalogue', () => {
      const many = Array.from({ length: MAX_PRICE_SKUS + 25 }, (_, i) => `AG-SKU-${i}`).join(',');
      expect(skusFrom(many)).toHaveLength(MAX_PRICE_SKUS);
    });
  });
});
