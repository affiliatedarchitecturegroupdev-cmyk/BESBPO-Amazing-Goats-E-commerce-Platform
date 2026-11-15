import { describe, it, expect } from 'vitest';
import {
  InMemoryIdempotencyStore,
  applyStatus,
  canTransition,
  createIntent,
  isTerminal,
} from './payment-intent';

describe('createIntent', () => {
  it('creates an intent in the created state', async () => {
    const store = new InMemoryIdempotencyStore();
    const intent = await createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 310_500 },
      store,
    );
    expect(intent.status).toBe('created');
    expect(intent.currency).toBe('ZAR');
    expect(intent.amountIncVatCents).toBe(310_500);
  });

  it('returns the same intent for the same idempotency key', async () => {
    const store = new InMemoryIdempotencyStore();
    const first = await createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 },
      store,
    );
    const second = await createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 },
      store,
    );
    expect(second.id).toBe(first.id);
    expect(await store.get('k1')).toEqual(first);
  });

  it('rejects a key reused with a different amount', async () => {
    const store = new InMemoryIdempotencyStore();
    await createIntent({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 }, store);
    await expect(
      createIntent({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 2000 }, store),
    ).rejects.toThrow(/different amount/);
  });

  it('requires a positive integer amount and a key', async () => {
    const store = new InMemoryIdempotencyStore();
    await expect(
      createIntent({ idempotencyKey: '', method: 'card', amountIncVatCents: 100 }, store),
    ).rejects.toThrow();
    await expect(
      createIntent({ idempotencyKey: 'k', method: 'card', amountIncVatCents: 0 }, store),
    ).rejects.toThrow();
    await expect(
      createIntent({ idempotencyKey: 'k', method: 'card', amountIncVatCents: 1.5 }, store),
    ).rejects.toThrow();
  });
});

describe('intent status machine', () => {
  it('allows the forward path and blocks a terminal change', () => {
    expect(canTransition('created', 'pending')).toBe(true);
    expect(canTransition('pending', 'succeeded')).toBe(true);
    expect(canTransition('succeeded', 'failed')).toBe(false);
    expect(canTransition('failed', 'succeeded')).toBe(false);
    expect(isTerminal('succeeded')).toBe(true);
    expect(isTerminal('created')).toBe(false);
  });

  it('is idempotent when the status is unchanged', async () => {
    const store = new InMemoryIdempotencyStore();
    const intent = await createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 },
      store,
    );
    const same = applyStatus(intent, 'created');
    expect(same).toBe(intent);
  });

  it('throws on an illegal transition', async () => {
    const store = new InMemoryIdempotencyStore();
    const intent = {
      ...(await createIntent({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 }, store)),
      status: 'succeeded' as const,
    };
    expect(() => applyStatus(intent, 'failed')).toThrow(/cannot move intent/);
  });
});
