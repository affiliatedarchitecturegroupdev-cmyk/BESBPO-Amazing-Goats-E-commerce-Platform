import { describe, expect, it } from 'vitest';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AUTHENTICATED_KEY, PERMS_KEY } from '@ag/nest-auth';
import { MySubscriptionsController } from './my-subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { InMemorySubscriptionStore } from './subscriptions.store';

/**
 * The controller is where the audience rule could silently widen. Copying
 * `@RequirePermissions('orders:read')` from `SubscriptionsController` would look
 * like a guard but would lock every real customer out of their own schedule —
 * a customer holds only `customer:own`. These tests read the metadata the
 * `PermissionsGuard` actually dispatches on.
 */

const service = () =>
  new SubscriptionsService(
    new InMemorySubscriptionStore([
      {
        id: 'sub_1',
        customerUserId: 'user_1',
        bundleId: null,
        cadence: 'weekly',
        nextRunAt: '2026-11-29T15:00:00.000Z',
        paused: false,
      },
    ]),
    { list: async () => [] },
  );

const handlers = ['list', 'get', 'pause', 'resume'] as const;
const proto = MySubscriptionsController.prototype as unknown as Record<string, object>;

describe('MySubscriptionsController', () => {
  it('mounts on its own path, not the staff path', () => {
    expect(Reflect.getMetadata('path', MySubscriptionsController)).toBe('commerce/my-subscriptions');
  });

  it('requires a signed-in caller on every route', () => {
    for (const name of handlers) {
      expect(Reflect.getMetadata(AUTHENTICATED_KEY, proto[name]), `${name} is authenticated`).toBe(true);
    }
  });

  it('never demands a staff permission, so a customer can reach it', () => {
    for (const name of handlers) {
      expect(Reflect.getMetadata(PERMS_KEY, proto[name]), `${name} must not need orders:read`).toBeUndefined();
    }
  });

  it('relies on the global guard rather than a route-local one', () => {
    for (const name of handlers) {
      expect(Reflect.getMetadata(GUARDS_METADATA, proto[name])).toBeUndefined();
    }
  });

  it("lists the caller's own subscriptions through the service", async () => {
    const controller = new MySubscriptionsController(service());
    const rows = await controller.list({ user: { id: 'user_1', roles: ['customer_household'] } });
    expect(rows.map((r) => r.id)).toEqual(['sub_1']);
  });

  it('treats an anonymous request as a refusal, not an empty schedule', async () => {
    const controller = new MySubscriptionsController(service());
    await expect(controller.list({})).rejects.toThrow(/sign in/i);
  });

  it('lets the owner pause their own subscription', async () => {
    const controller = new MySubscriptionsController(service());
    const paused = await controller.pause('sub_1', { user: { id: 'user_1', roles: ['customer_household'] } });
    expect(paused.paused).toBe(true);
  });
});
