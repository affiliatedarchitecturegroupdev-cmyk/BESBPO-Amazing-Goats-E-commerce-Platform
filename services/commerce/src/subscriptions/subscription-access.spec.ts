import { describe, expect, it } from 'vitest';
import { canViewSubscription, toPublicSubscription } from './subscription-access';
import type { Subscription } from './subscriptions.types';

function subscription(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_1',
    customerUserId: 'user-a',
    bundleId: null,
    cadence: 'weekly',
    nextRunAt: '2026-11-29T15:00:00.000Z',
    paused: false,
    ...overrides,
  };
}

describe('canViewSubscription', () => {
  it('lets the owner see their own subscription', () => {
    expect(canViewSubscription(subscription(), { userId: 'user-a', staff: false })).toBe(true);
  });

  it('refuses another customer', () => {
    expect(canViewSubscription(subscription(), { userId: 'user-b', staff: false })).toBe(false);
  });

  it('refuses an anonymous caller', () => {
    expect(canViewSubscription(subscription(), { staff: false })).toBe(false);
  });

  it('lets staff see any subscription, because they hold orders:read', () => {
    expect(canViewSubscription(subscription(), { userId: 'staff-1', staff: true })).toBe(true);
  });

  it('refuses a customer a subscription with no owner', () => {
    expect(canViewSubscription(subscription({ customerUserId: '' }), { userId: 'user-a', staff: false })).toBe(false);
  });
});

describe('toPublicSubscription', () => {
  it('drops the owner id so it cannot leak to the storefront', () => {
    const view = toPublicSubscription(subscription());
    expect(view).not.toHaveProperty('customerUserId');
    expect(view).not.toHaveProperty('bundleId');
  });

  it('carries the schedule the page renders', () => {
    expect(toPublicSubscription(subscription())).toEqual({
      id: 'sub_1',
      cadence: 'weekly',
      nextRunAt: '2026-11-29T15:00:00.000Z',
      paused: false,
      skipped: [],
    });
  });

  it('normalises a missing skipped list to an empty one', () => {
    expect(toPublicSubscription(subscription({ skipped: undefined })).skipped).toEqual([]);
  });
});
