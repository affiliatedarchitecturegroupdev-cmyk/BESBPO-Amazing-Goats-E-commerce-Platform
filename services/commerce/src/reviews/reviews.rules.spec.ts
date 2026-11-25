import { describe, it, expect } from 'vitest';
import {
  aggregate,
  decideModeration,
  decideSubmission,
  deliveredPurchaseFor,
  isPublic,
  mayRate,
  submissionKind,
  type PurchaseFact,
} from './reviews.rules';

const customer = { userId: 'u1', roles: ['customer_household'] };
const trade = { userId: 'u2', roles: ['trade_owner'] };
const stranger = { userId: 'u3', roles: [] };

const delivered: PurchaseFact = {
  variantId: 'v1',
  orderId: 'o1',
  orderLineId: 'l1',
  orderStatus: 'delivered',
};
const inFlight: PurchaseFact = { ...delivered, orderLineId: 'l2', orderStatus: 'out_for_delivery' };

describe('mayRate', () => {
  it('lets a customer and a trade account rate', () => {
    expect(mayRate(['customer_household'])).toBe(true);
    expect(mayRate(['trade_owner'])).toBe(true);
    expect(mayRate(['trade_buyer'])).toBe(true);
  });

  it('refuses someone with no customer or trade role', () => {
    expect(mayRate([])).toBe(false);
    expect(mayRate(['analyst'])).toBe(false);
  });
});

describe('submissionKind', () => {
  it('is a rating when there is no text and no photo', () => {
    expect(submissionKind({})).toBe('rating');
    expect(submissionKind({ body: '   ' })).toBe('rating');
    expect(submissionKind({ body: null, photoUrl: null })).toBe('rating');
  });

  it('is a review when there is text or a photo', () => {
    expect(submissionKind({ body: 'Lovely curry' })).toBe('review');
    expect(submissionKind({ photoUrl: 'https://cdn/x.jpg' })).toBe('review');
  });
});

describe('deliveredPurchaseFor', () => {
  it('accepts only a delivered order', () => {
    expect(deliveredPurchaseFor('v1', [inFlight])).toBeUndefined();
    expect(deliveredPurchaseFor('v1', [delivered])).toEqual(delivered);
  });

  it('ignores a delivered line for a different variant', () => {
    expect(deliveredPurchaseFor('v2', [delivered])).toBeUndefined();
  });

  it('picks the most recent delivered line, so a repeat buyer reviews a real order', () => {
    const older = { ...delivered, orderId: 'o0', orderLineId: 'l0' };
    expect(deliveredPurchaseFor('v1', [older, delivered])).toEqual(delivered);
  });
});

describe('decideSubmission — rating', () => {
  it('lets a registered non-purchaser rate', () => {
    const decision = decideSubmission({ variantId: 'v1', rating: 4 }, customer, []);
    expect(decision).toEqual({ allowed: true, kind: 'rating', verifiedPurchase: false });
  });

  it('lets a trade account rate without a purchase', () => {
    expect(decideSubmission({ variantId: 'v1', rating: 5 }, trade, []).allowed).toBe(true);
  });

  it('refuses an unregistered user', () => {
    const decision = decideSubmission({ variantId: 'v1', rating: 4 }, stranger, []);
    expect(decision).toEqual({
      allowed: false,
      reason: 'only a customer or trade account may rate a product',
    });
  });

  it('rejects a rating outside 1 to 5 and a fractional one', () => {
    for (const rating of [0, 6, -1, 3.5]) {
      const decision = decideSubmission({ variantId: 'v1', rating }, customer, []);
      expect(decision.allowed).toBe(false);
    }
  });
});

describe('decideSubmission — review with text', () => {
  it('refuses a non-purchaser, and says what is missing', () => {
    const decision = decideSubmission({ variantId: 'v1', rating: 5, body: 'great' }, customer, []);
    expect(decision).toEqual({
      allowed: false,
      reason: 'a written review needs a delivered order for this product',
    });
  });

  it('refuses a purchase that has not been delivered yet', () => {
    const decision = decideSubmission({ variantId: 'v1', rating: 5, body: 'great' }, customer, [
      inFlight,
    ]);
    expect(decision.allowed).toBe(false);
  });

  it('accepts a purchaser and marks the review verified, against that order', () => {
    const decision = decideSubmission({ variantId: 'v1', rating: 5, body: 'great' }, customer, [
      delivered,
    ]);
    expect(decision).toEqual({
      allowed: true,
      kind: 'review',
      verifiedPurchase: true,
      order: delivered,
    });
  });

  it('accepts a photo-only review from a purchaser', () => {
    const decision = decideSubmission(
      { variantId: 'v1', rating: 5, photoUrl: 'https://cdn/x.jpg' },
      customer,
      [delivered],
    );
    expect(decision.allowed && decision.kind).toBe('review');
  });

  it('does not require a purchase for a rating even when one exists', () => {
    const decision = decideSubmission({ variantId: 'v1', rating: 4 }, customer, [delivered]);
    expect(decision).toEqual({ allowed: true, kind: 'rating', verifiedPurchase: false });
  });
});

describe('aggregate', () => {
  it('counts ratings and written reviews separately', () => {
    const rows = [
      { rating: 5, body: 'Lovely', verifiedPurchase: true },
      { rating: 4, body: null, verifiedPurchase: false },
      { rating: 3, body: '   ', verifiedPurchase: false },
      { rating: 4, body: null, verifiedPurchase: false },
    ];
    const result = aggregate(rows);
    expect(result.ratingCount).toBe(4);
    expect(result.reviewCount).toBe(1);
    expect(result.averageRating).toBe(4);
    expect(result.verifiedCount).toBe(1);
  });

  it('does not present 40 ratings and 2 reviews as 40 reviews', () => {
    const rows = [
      ...Array.from({ length: 38 }, () => ({ rating: 5, body: null, verifiedPurchase: false })),
      { rating: 5, body: 'a', verifiedPurchase: false },
      { rating: 5, body: 'b', verifiedPurchase: false },
    ];
    const result = aggregate(rows);
    expect(result.ratingCount).toBe(40);
    expect(result.reviewCount).toBe(2);
  });

  it('reports a null average when there are no ratings, not zero', () => {
    expect(aggregate([]).averageRating).toBeNull();
  });

  it('rounds the average to one decimal', () => {
    expect(aggregate([
      { rating: 4, body: null, verifiedPurchase: false },
      { rating: 5, body: null, verifiedPurchase: false },
      { rating: 5, body: null, verifiedPurchase: false },
    ]).averageRating).toBe(4.7);
  });
});

describe('isPublic', () => {
  it('shows only published rows', () => {
    expect(isPublic('published')).toBe(true);
    expect(isPublic('pending')).toBe(false);
    expect(isPublic('rejected')).toBe(false);
  });
});

describe('decideModeration', () => {
  it('publishes without needing a reason', () => {
    expect(decideModeration('publish', undefined)).toEqual({ allowed: true, status: 'published' });
  });

  it('rejects with a reason', () => {
    expect(decideModeration('reject', 'contains a competitor link')).toEqual({
      allowed: true,
      status: 'rejected',
    });
  });

  it('refuses a rejection with no reason, because the author must be told why', () => {
    expect(decideModeration('reject', undefined).allowed).toBe(false);
    expect(decideModeration('reject', '   ').allowed).toBe(false);
  });
});
