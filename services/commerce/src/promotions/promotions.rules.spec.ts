import { describe, it, expect } from 'vitest';
import {
  PromotionError,
  applyPromotions,
  approvePromotion,
  assertValidPromotion,
  endPromotion,
  goodsDiscountCents,
  isActive,
  subtotalCents,
} from './promotions.rules';
import { Promotion, PromotionCart } from './promotions.types';

const AT = new Date('2026-06-01T10:00:00.000Z');

function promo(over: Partial<Promotion> = {}): Promotion {
  return {
    id: 'pr_1',
    code: 'WINTER10',
    name: 'Winter 10%',
    kind: 'percent',
    percent: 10,
    startsAt: '2026-01-01T00:00:00.000Z',
    endsAt: null,
    status: 'approved',
    stackable: true,
    ...over,
  };
}

const cart: PromotionCart = {
  lines: [
    { sku: 'AG-LB-001', qty: 2, unitPriceExVatCents: 45_000 },
    { sku: 'AG-EG-001', qty: 1, unitPriceExVatCents: 3_500 },
  ],
};

describe('subtotalCents', () => {
  it('multiplies quantity by unit price in integer cents', () => {
    expect(subtotalCents(cart.lines)).toBe(93_500);
  });
});

describe('isActive', () => {
  it('is live only when approved and inside the half-open window', () => {
    expect(isActive(promo(), AT)).toBe(true);
    expect(isActive(promo({ status: 'draft' }), AT)).toBe(false);
    expect(isActive(promo({ startsAt: '2026-07-01T00:00:00.000Z' }), AT)).toBe(false);
    expect(isActive(promo({ endsAt: '2026-06-01T10:00:00.000Z' }), AT)).toBe(false);
  });
});

describe('goodsDiscountCents', () => {
  it('takes a percentage of the eligible total', () => {
    expect(goodsDiscountCents(promo({ percent: 15 }), 100_000)).toBe(15_000);
  });
  it('caps an amount at the eligible total', () => {
    expect(goodsDiscountCents(promo({ kind: 'amount', valueCents: 20_000 }), 10_000)).toBe(10_000);
  });
  it('sets a bundle price by subtracting the bundle value', () => {
    expect(goodsDiscountCents(promo({ kind: 'bundle_price', valueCents: 30_000 }), 45_000)).toBe(15_000);
  });
  it('never touches the goods total for free delivery', () => {
    expect(goodsDiscountCents(promo({ kind: 'free_delivery' }), 45_000)).toBe(0);
  });
});

describe('applyPromotions', () => {
  it('applies a whole-cart percentage', () => {
    const result = applyPromotions(cart, [promo({ percent: 10 })], AT);
    expect(result.discountCents).toBe(9_350);
    expect(result.discountedSubtotalExVatCents).toBe(84_150);
    expect(result.applied.map((a) => a.code)).toEqual(['WINTER10']);
  });

  it('scopes a promotion to the SKUs it names', () => {
    const result = applyPromotions(cart, [promo({ percent: 10, skus: ['AG-LB-001'] })], AT);
    expect(result.discountCents).toBe(9_000); // 10% of 90 000 only
    expect(result.applied[0].skus).toEqual(['AG-LB-001']);
  });

  it('waives delivery without discounting goods', () => {
    const result = applyPromotions(cart, [promo({ kind: 'free_delivery', code: 'FREESHIP' })], AT);
    expect(result.freeDelivery).toBe(true);
    expect(result.discountCents).toBe(0);
  });

  it('never takes the payable goods amount below zero', () => {
    const result = applyPromotions(cart, [promo({ kind: 'amount', valueCents: 500_000 })], AT);
    expect(result.discountCents).toBe(93_500);
    expect(result.discountedSubtotalExVatCents).toBe(0);
  });

  it('stacks stackable promotions', () => {
    const result = applyPromotions(
      cart,
      [promo({ code: 'A', percent: 10 }), promo({ code: 'B', kind: 'amount', valueCents: 1_000 })],
      AT,
    );
    expect(result.discountCents).toBe(10_350);
    expect(result.applied.map((a) => a.code)).toEqual(['A', 'B']);
  });

  it('runs an exclusive promotion alone and rejects the rest', () => {
    const result = applyPromotions(
      cart,
      [
        promo({ code: 'BIG', kind: 'amount', valueCents: 20_000, stackable: false }),
        promo({ code: 'SMALL', kind: 'amount', valueCents: 5_000 }),
      ],
      AT,
    );
    expect(result.applied.map((a) => a.code)).toEqual(['BIG']);
    expect(result.rejected).toEqual([{ code: 'SMALL', reason: 'superseded_by_exclusive' }]);
  });

  it('picks the larger exclusive when two compete', () => {
    const result = applyPromotions(
      cart,
      [
        promo({ code: 'BIG', kind: 'amount', valueCents: 20_000, stackable: false }),
        promo({ code: 'BIGGER', kind: 'amount', valueCents: 30_000, stackable: false }),
      ],
      AT,
    );
    expect(result.applied.map((a) => a.code)).toEqual(['BIGGER']);
  });

  it('reports why a promotion did not apply', () => {
    const used: PromotionCart = { ...cart, customerUses: { CAP: 1 } };
    const result = applyPromotions(
      used,
      [
        promo({ code: 'MIN', minSpendCents: 500_000 }),
        promo({ code: 'LATE', startsAt: '2026-07-01T00:00:00.000Z' }),
        promo({ code: 'OFFSKU', skus: ['AG-XX-999'] }),
        promo({ code: 'CAP', maxUsesPerCustomer: 1 }),
      ],
      AT,
    );
    const reasons = Object.fromEntries(result.rejected.map((r) => [r.code, r.reason]));
    expect(reasons).toEqual({
      MIN: 'below_min_spend',
      LATE: 'not_active',
      OFFSKU: 'no_eligible_lines',
      CAP: 'usage_limit_reached',
    });
    expect(result.discountCents).toBe(0);
  });

  it('honours the per-customer usage cap', () => {
    const used: PromotionCart = { ...cart, customerUses: { WINTER10: 2 } };
    const result = applyPromotions(used, [promo({ maxUsesPerCustomer: 2 })], AT);
    expect(result.applied).toHaveLength(0);
    expect(result.rejected[0]).toEqual({ code: 'WINTER10', reason: 'usage_limit_reached' });
  });
});

describe('approvePromotion', () => {
  it('approves a draft and records the approver', () => {
    const approved = approvePromotion(promo({ status: 'draft' }), 'user_b');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('user_b');
  });
  it('refuses to approve anything but a draft', () => {
    expect(() => approvePromotion(promo(), 'user_b')).toThrow(PromotionError);
  });
});

describe('endPromotion', () => {
  it('retires an approved promotion', () => {
    expect(endPromotion(promo()).status).toBe('ended');
  });
  it('refuses to end a draft', () => {
    expect(() => endPromotion(promo({ status: 'draft' }))).toThrow(PromotionError);
  });
});

describe('assertValidPromotion', () => {
  it('requires a percent in range', () => {
    expect(() => assertValidPromotion(promo({ percent: 0 }))).toThrow(/percent/);
    expect(() => assertValidPromotion(promo({ percent: 101 }))).toThrow(/percent/);
  });
  it('requires a non-negative integer value for amount and bundle_price', () => {
    expect(() => assertValidPromotion(promo({ kind: 'amount', valueCents: undefined }))).toThrow(/valueCents/);
    expect(() => assertValidPromotion(promo({ kind: 'bundle_price', valueCents: 10.5 }))).toThrow(/valueCents/);
  });
  it('rejects a window that ends before it starts', () => {
    expect(() => assertValidPromotion(promo({ endsAt: '2025-01-01T00:00:00.000Z' }))).toThrow(/ends before/);
  });
});
