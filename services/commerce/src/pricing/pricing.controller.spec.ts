import { describe, it, expect } from 'vitest';
import { requiresSecondApprover } from '@ag/rbac';
import { PricingController } from './pricing.controller';
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
    const price = await controller([live]).price({ sku: 'AG-LB-005' });
    expect(price?.audience).toBe('public');
  });

  it('ignores an unknown audience and falls back to public', async () => {
    const live = { ...draft(), status: 'published' as const };
    const price = await controller([live]).price({ sku: 'AG-LB-005', audience: 'nonsense' });
    expect(price?.audience).toBe('public');
  });

  it('keeps the four-eyes rule aligned with the RBAC two-person list', () => {
    // If pricing:approve is ever removed from TWO_PERSON, this fails and the
    // publish guard must be revisited together with the RBAC matrix.
    expect(requiresSecondApprover('pricing:approve')).toBe(true);
  });
});
