import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { PromotionsService } from './promotions.service';
import { InMemoryPromotionStore } from './promotions.store';
import { Promotion, PromotionCart } from './promotions.types';

const draft: Promotion = {
  id: 'pr_new',
  code: 'SPRING5',
  name: 'Spring 5%',
  kind: 'percent',
  percent: 5,
  startsAt: '2026-01-01T00:00:00.000Z',
  endsAt: null,
  status: 'draft',
  stackable: true,
};

const cart: PromotionCart = {
  lines: [{ sku: 'AG-LB-001', qty: 1, unitPriceExVatCents: 10_000 }],
};

const service = (seed: Promotion[] = []) => new PromotionsService(new InMemoryPromotionStore(seed));

describe('PromotionsService', () => {
  it('creates a draft and reads it back', async () => {
    const svc = service();
    const created = await svc.create(draft);
    expect(created.status).toBe('draft');
    expect((await svc.get('pr_new')).code).toBe('SPRING5');
    expect(await svc.list()).toHaveLength(1);
  });

  it('refuses a duplicate code', async () => {
    const svc = service();
    await svc.create(draft);
    await expect(svc.create({ ...draft, id: 'pr_other' })).rejects.toThrow(/already exists/);
  });

  it('approves a draft then prices a cart with it', async () => {
    const svc = service();
    await svc.create(draft);
    await svc.approve('pr_new', 'user_b');
    const result = await svc.evaluate(cart, new Date('2026-06-01T10:00:00.000Z'));
    expect(result.discountCents).toBe(500);
  });

  it('does not apply a draft promotion', async () => {
    const svc = service();
    await svc.create(draft);
    const result = await svc.evaluate(cart, new Date('2026-06-01T10:00:00.000Z'));
    expect(result.discountCents).toBe(0);
    expect(result.rejected[0].reason).toBe('not_active');
  });

  it('ends a promotion so it stops applying', async () => {
    const svc = service();
    await svc.create(draft);
    await svc.approve('pr_new', 'user_b');
    await svc.end('pr_new');
    const result = await svc.evaluate(cart, new Date('2026-06-01T10:00:00.000Z'));
    expect(result.discountCents).toBe(0);
  });

  it('404s on an unknown promotion', async () => {
    await expect(service().get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});
