import { describe, it, expect } from 'vitest';
import { InMemoryReviewAudit, ReviewsService, ReviewNotAllowedError } from './reviews.service';
import { InMemoryReviewStore } from './reviews.store';

const at = new Date('2026-03-01T08:00:00Z');
const customer = { userId: 'u1', roles: ['customer_household'] };
const stranger = { userId: 'u3', roles: [] };

function setup() {
  const store = new InMemoryReviewStore();
  const audit = new InMemoryReviewAudit();
  return { store, audit, service: new ReviewsService(store, audit) };
}

describe('submit — rating', () => {
  it('lets a registered non-purchaser rate', async () => {
    const { service } = setup();
    const review = await service.submit({ variantId: 'v1', rating: 4 }, customer, at);
    expect(review.rating).toBe(4);
    expect(review.status).toBe('pending');
    expect(review.verifiedPurchase).toBe(false);
  });

  it('refuses an unregistered user with a plain reason', async () => {
    const { service } = setup();
    await expect(service.submit({ variantId: 'v1', rating: 4 }, stranger, at)).rejects.toThrow(
      ReviewNotAllowedError,
    );
  });
});

describe('submit — review with text', () => {
  it('refuses a registered non-purchaser', async () => {
    const { service } = setup();
    await expect(
      service.submit({ variantId: 'v1', rating: 5, body: 'great' }, customer, at),
    ).rejects.toThrow('a written review needs a delivered order');
  });

  it('accepts a purchaser and sets verifiedPurchase from the order', async () => {
    const { service, store } = setup();
    store.addPurchase('u1', {
      variantId: 'v1',
      orderId: 'o1',
      orderLineId: 'l1',
      orderStatus: 'delivered',
    });

    const review = await service.submit({ variantId: 'v1', rating: 5, body: 'great' }, customer, at);
    expect(review.verifiedPurchase).toBe(true);
    expect(review.orderId).toBe('o1');
    expect(review.orderLineId).toBe('l1');
  });

  it('ignores a verifiedPurchase claimed in the request body', async () => {
    const { service } = setup();
    const review = await service.submit(
      // A caller claiming a purchase must not be believed.
      { variantId: 'v1', rating: 5, body: 'great', ...({ verifiedPurchase: true } as object) },
      customer,
      at,
    ).catch(() => undefined);
    expect(review).toBeUndefined();
  });

  it('refuses an order that is not delivered yet', async () => {
    const { service, store } = setup();
    store.addPurchase('u1', {
      variantId: 'v1',
      orderId: 'o1',
      orderLineId: 'l1',
      orderStatus: 'out_for_delivery',
    });
    await expect(
      service.submit({ variantId: 'v1', rating: 5, body: 'great' }, customer, at),
    ).rejects.toThrow('a written review needs a delivered order');
  });
});

describe('submit — duplicates', () => {
  it('refuses a second bare rating for the same variant', async () => {
    const { service } = setup();
    await service.submit({ variantId: 'v1', rating: 4 }, customer, at);
    await expect(service.submit({ variantId: 'v1', rating: 5 }, customer, at)).rejects.toThrow(
      'already rated or reviewed',
    );
  });

  it('refuses a second review for the same order', async () => {
    const { service, store } = setup();
    store.addPurchase('u1', {
      variantId: 'v1',
      orderId: 'o1',
      orderLineId: 'l1',
      orderStatus: 'delivered',
    });
    await service.submit({ variantId: 'v1', rating: 5, body: 'first' }, customer, at);
    await expect(
      service.submit({ variantId: 'v1', rating: 4, body: 'second' }, customer, at),
    ).rejects.toThrow('already rated or reviewed');
  });

  it('allows a different user to rate the same variant', async () => {
    const { service } = setup();
    await service.submit({ variantId: 'v1', rating: 4 }, customer, at);
    const other = await service.submit({ variantId: 'v1', rating: 5 }, { userId: 'u2', roles: ['trade_owner'] }, at);
    expect(other.userId).toBe('u2');
  });
});

describe('remove', () => {
  it('lets a customer delete their own review', async () => {
    const { service } = setup();
    const review = await service.submit({ variantId: 'v1', rating: 4 }, customer, at);
    expect(await service.remove(review.id, customer)).toBe(true);
  });

  it('refuses to delete another person\'s review', async () => {
    const { service } = setup();
    const review = await service.submit({ variantId: 'v1', rating: 4 }, customer, at);
    await expect(
      service.remove(review.id, { userId: 'u2', roles: ['customer_household'] }),
    ).rejects.toThrow('only delete your own');
  });

  it('lets staff delete any review', async () => {
    const { service } = setup();
    const review = await service.submit({ variantId: 'v1', rating: 4 }, customer, at);
    expect(await service.remove(review.id, { userId: 'staff', roles: ['support'] })).toBe(true);
  });
});

describe('moderation', () => {
  it('publishes a pending review and records the decision', async () => {
    const { service, audit, store } = setup();
    store.addPurchase('u1', { variantId: 'v1', orderId: 'o1', orderLineId: 'l1', orderStatus: 'delivered' });
    const review = await service.submit({ variantId: 'v1', rating: 5, body: 'great' }, customer, at);

    const published = await service.moderate(review.id, 'publish', 'staff1', undefined, at);
    expect(published.status).toBe('published');
    expect(published.moderatedBy).toBe('staff1');

    const entries = await audit.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ reviewId: review.id, action: 'publish', by: 'staff1' });
  });

  it('rejects with a reason and stores it for the author', async () => {
    const { service, audit, store } = setup();
    store.addPurchase('u1', { variantId: 'v1', orderId: 'o1', orderLineId: 'l1', orderStatus: 'delivered' });
    const review = await service.submit({ variantId: 'v1', rating: 5, body: 'great' }, customer, at);

    const rejected = await service.moderate(
      review.id,
      'reject',
      'staff1',
      'contains a competitor link',
      at,
    );
    expect(rejected.status).toBe('rejected');
    expect(rejected.rejectedReason).toBe('contains a competitor link');
    expect((await audit.entries())[0].reason).toBe('contains a competitor link');
  });

  it('refuses a rejection with no reason and audits nothing', async () => {
    const { service, audit, store } = setup();
    store.addPurchase('u1', { variantId: 'v1', orderId: 'o1', orderLineId: 'l1', orderStatus: 'delivered' });
    const review = await service.submit({ variantId: 'v1', rating: 5, body: 'great' }, customer, at);

    await expect(service.moderate(review.id, 'reject', 'staff1', undefined, at)).rejects.toThrow(
      'a rejection needs a reason',
    );
    expect(await audit.entries()).toHaveLength(0);
  });

  it('throws for an unknown review', async () => {
    const { service } = setup();
    await expect(service.moderate('nope', 'publish', 'staff1', undefined, at)).rejects.toThrow(
      'no such review',
    );
  });
});

describe('listPublished', () => {
  it('shows only published rows and reports ratings and reviews separately', async () => {
    const { service, store } = setup();
    store.addPurchase('u1', {
      variantId: 'v1',
      orderId: 'o1',
      orderLineId: 'l1',
      orderStatus: 'delivered',
    });

    const written = await service.submit({ variantId: 'v1', rating: 5, body: 'Lovely' }, customer, at);
    const bare = await service.submit(
      { variantId: 'v1', rating: 4 },
      { userId: 'u2', roles: ['customer_household'] },
      at,
    );
    const pending = await service.submit(
      { variantId: 'v1', rating: 1 },
      { userId: 'u4', roles: ['customer_household'] },
      at,
    );

    await service.moderate(written.id, 'publish', 'staff1', undefined, at);
    await service.moderate(bare.id, 'publish', 'staff1', undefined, at);

    const result = await service.listPublished('v1');
    expect(result.reviews.map((r) => r.id)).toEqual([written.id, bare.id]);
    expect(result.reviews.map((r) => r.id)).not.toContain(pending.id);
    expect(result.aggregate.ratingCount).toBe(2);
    expect(result.aggregate.reviewCount).toBe(1);
    expect(result.aggregate.averageRating).toBe(4.5);
  });

  it('returns an empty list and a null average for a variant with nothing published', async () => {
    const { service } = setup();
    const result = await service.listPublished('v-none');
    expect(result.reviews).toEqual([]);
    expect(result.aggregate.averageRating).toBeNull();
  });
});
