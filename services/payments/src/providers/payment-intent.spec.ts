import { describe, it, expect } from 'vitest';
import {
  InMemoryIdempotencyStore,
  applyStatus,
  canTransition,
  createIntent,
  isTerminal,
} from './payment-intent';

describe('createIntent', () => {
  it('creates an intent in the created state', () => {
    const store = new InMemoryIdempotencyStore();
    const intent = createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 310_500 },
      store,
    );
    expect(intent.status).toBe('created');
    expect(intent.currency).toBe('ZAR');
    expect(intent.amountIncVatCents).toBe(310_500);
  });

  it('returns the same intent for the same idempotency key', () => {
    const store = new InMemoryIdempotencyStore();
    const first = createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 },
      store,
    );
    const second = createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 },
      store,
    );
    expect(second.id).toBe(first.id);
    expect(store.get('k1')).toEqual(first);
  });

  it('rejects a key reused with a different amount', () => {
    const store = new InMemoryIdempotencyStore();
    createIntent({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 }, store);
    expect(() =>
      createIntent({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 2000 }, store),
    ).toThrow(/different amount/);
  });

  it('requires a positive integer amount and a key', () => {
    const store = new InMemoryIdempotencyStore();
    expect(() =>
      createIntent({ idempotencyKey: '', method: 'card', amountIncVatCents: 100 }, store),
    ).toThrow();
    expect(() =>
      createIntent({ idempotencyKey: 'k', method: 'card', amountIncVatCents: 0 }, store),
    ).toThrow();
    expect(() =>
      createIntent({ idempotencyKey: 'k', method: 'card', amountIncVatCents: 1.5 }, store),
    ).toThrow();
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

  it('is idempotent when the status is unchanged', () => {
    const store = new InMemoryIdempotencyStore();
    const intent = createIntent(
      { idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 },
      store,
    );
    const same = applyStatus(intent, 'created');
    expect(same).toBe(intent);
  });

  it('throws on an illegal transition', () => {
    const store = new InMemoryIdempotencyStore();
    const intent = {
      ...createIntent({ idempotencyKey: 'k1', method: 'card', amountIncVatCents: 1000 }, store),
      status: 'succeeded' as const,
    };
    expect(() => applyStatus(intent, 'failed')).toThrow(/cannot move intent/);
  });
});
