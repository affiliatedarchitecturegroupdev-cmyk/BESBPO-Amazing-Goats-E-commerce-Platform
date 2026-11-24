import { describe, it, expect } from 'vitest';
import type { OrderStatus } from '@ag/shared-types';
import { TRACK_STEPS, orderReference, orderTimeline } from './track';

const ALL: OrderStatus[] = [
  'pending_payment', 'confirmed', 'in_cycle', 'packing',
  'out_for_delivery', 'delivered', 'cancelled', 'refunded',
];

describe('orderTimeline', () => {
  it('has a defined timeline for every order status', () => {
    for (const status of ALL) {
      const t = orderTimeline(status);
      expect(Array.isArray(t.steps)).toBe(true);
      expect(typeof t.terminal).toBe('boolean');
    }
  });

  it('marks nothing complete while payment is pending', () => {
    const t = orderTimeline('pending_payment');
    expect(t.steps).toHaveLength(4);
    expect(t.steps.every((s) => s.state === 'pending')).toBe(true);
    expect(t.nextAction).toMatch(/payment/i);
  });

  it('marks confirmed as the first active step', () => {
    const t = orderTimeline('confirmed');
    expect(t.steps[0]).toMatchObject({ step: 'confirmed', state: 'active' });
    expect(t.steps.slice(1).every((s) => s.state === 'pending')).toBe(true);
  });

  it('treats a scheduled cycle order as confirmed for the shopper', () => {
    expect(orderTimeline('in_cycle').steps[0].state).toBe('active');
  });

  it('marks earlier steps done as the order advances', () => {
    const t = orderTimeline('out_for_delivery');
    expect(t.steps.map((s) => s.state)).toEqual(['done', 'done', 'active', 'pending']);
  });

  it('completes on delivered with no next action', () => {
    const t = orderTimeline('delivered');
    expect(t.complete).toBe(true);
    expect(t.steps.at(-1)).toMatchObject({ state: 'active' });
    expect(t.nextAction).toBeNull();
  });

  it('shows no steps for a cancelled order, so it does not imply a parcel is coming', () => {
    const t = orderTimeline('cancelled');
    expect(t.steps).toEqual([]);
    expect(t.terminal).toBe(true);
    expect(t.nextAction).toMatch(/cancelled/i);
  });

  it('shows no steps for a refunded order', () => {
    const t = orderTimeline('refunded');
    expect(t.steps).toEqual([]);
    expect(t.terminal).toBe(true);
    expect(t.nextAction).toMatch(/refunded/i);
  });

  it('never reports two active steps', () => {
    for (const status of ALL) {
      expect(orderTimeline(status).steps.filter((s) => s.state === 'active').length).toBeLessThanOrEqual(1);
    }
  });

  it('labels follow the wireframe order', () => {
    expect(TRACK_STEPS).toEqual(['confirmed', 'packing', 'out_for_delivery', 'delivered']);
  });
});

describe('orderReference', () => {
  it('reduces an epoch order id to the last six digits', () => {
    expect(orderReference('ord_1731234567890')).toBe('567890');
  });

  it('leaves an id alone when it has fewer than six digits', () => {
    expect(orderReference('ord_12')).toBe('ord_12');
  });

  it('is stable for the same id', () => {
    expect(orderReference('ord_1731234567890')).toBe(orderReference('ord_1731234567890'));
  });
});
