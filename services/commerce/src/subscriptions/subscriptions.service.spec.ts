import { describe, it, expect } from 'vitest';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { CycleRecord } from '../cycles/cycle-engine';
import { SubscriptionsService } from './subscriptions.service';
import { InMemorySubscriptionStore } from './subscriptions.store';
import { StandingOrder, Subscription } from './subscriptions.types';

const THIS_WEEK: CycleRecord = {
  id: 'chilled_meat:2026-11-15T15:00:00.000Z',
  productClass: 'chilled_meat',
  cutoffAt: '2026-11-15T15:00:00.000Z',
  deliveryFrom: '2026-11-18T04:00:00.000Z',
  deliveryTo: '2026-11-20T16:00:00.000Z',
  status: 'open',
};

const sub: Subscription = {
  id: 'sub_1',
  customerUserId: 'user_1',
  bundleId: 'bundle_braai',
  cadence: 'weekly',
  nextRunAt: '2026-11-11T08:00:00.000Z',
  paused: false,
};

const standing: StandingOrder = {
  id: 'so_1',
  orgId: 'org_1',
  dayOfWeek: 3,
  deliveryWindow: '06:00-10:00',
  pausedUntil: null,
  active: true,
  lines: [{ variantId: 'var_1', qty: 10 }],
};

const cycles = { list: async () => [THIS_WEEK] };
const service = (s: Subscription[] = [], so: StandingOrder[] = []) =>
  new SubscriptionsService(new InMemorySubscriptionStore(s, so), cycles);

describe('SubscriptionsService', () => {
  it('creates a subscription and reads it back', async () => {
    const svc = service();
    const created = await svc.create(sub);
    expect(created.id).toBe('sub_1');
    expect(await svc.list()).toHaveLength(1);
  });

  it('runs a due subscription, advancing one cadence and assigning the cycle', async () => {
    const svc = service([sub]);
    const result = await svc.run('sub_1', new Date('2026-11-11T08:00:00.000Z'));
    expect(result.subscription.nextRunAt).toBe('2026-11-18T08:00:00.000Z');
    expect(result.cycle?.id).toBe(THIS_WEEK.id);
  });

  it('skips a run but keeps the cadence', async () => {
    const svc = service([sub]);
    const skipped = await svc.skip('sub_1', new Date('2026-11-11T08:00:00.000Z'));
    expect(skipped.nextRunAt).toBe('2026-11-18T08:00:00.000Z');
    expect(skipped.skipped).toEqual(['2026-11-11T08:00:00.000Z']);
  });

  it('pause stops a run being due; resume restores it', async () => {
    const svc = service([sub]);
    const at = new Date('2026-11-11T09:00:00.000Z');
    await svc.pause('sub_1');
    expect(await svc.due(at)).toHaveLength(0);
    await svc.resume('sub_1');
    expect(await svc.due(at)).toHaveLength(1);
  });

  it('404s on an unknown subscription', async () => {
    await expect(service().get('nope')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates and lists a standing order', async () => {
    const svc = service();
    await svc.createStandingOrder(standing);
    expect(await svc.listStandingOrders()).toHaveLength(1);
  });

  it('reports a standing order due on its weekday', async () => {
    const svc = service([], [standing]);
    const due = await svc.dueStanding(new Date('2026-11-11T05:00:00.000Z'));
    expect(due).toHaveLength(1);
    expect(due[0].cycle?.id).toBe(THIS_WEEK.id);
  });

  it('deactivating a standing order stops it being due', async () => {
    const svc = service([], [standing]);
    await svc.setStandingOrderActive('so_1', false);
    expect(await svc.dueStanding(new Date('2026-11-11T05:00:00.000Z'))).toHaveLength(0);
  });
});

describe('SubscriptionsService — the shopper\'s own schedule (T-056)', () => {
  const mine = { ...sub, id: 'sub_mine', customerUserId: 'user_1' };
  const theirs = { ...sub, id: 'sub_theirs', customerUserId: 'user_2' };

  it('lists only the caller\'s subscriptions', async () => {
    const svc = service([mine, theirs]);
    const rows = await svc.mySubscriptions({ userId: 'user_1', staff: false });
    expect(rows.map((r) => r.id)).toEqual(['sub_mine']);
  });

  it('does not leak the owner id to the storefront', async () => {
    const svc = service([mine]);
    const [row] = await svc.mySubscriptions({ userId: 'user_1', staff: false });
    expect(row).not.toHaveProperty('customerUserId');
  });

  it('refuses an anonymous caller', async () => {
    const svc = service([mine]);
    await expect(svc.mySubscriptions({ staff: false })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('404s when a customer asks for another customer\'s subscription', async () => {
    const svc = service([theirs]);
    await expect(svc.mySubscription('sub_theirs', { userId: 'user_1', staff: false })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lets staff read any subscription', async () => {
    const svc = service([theirs]);
    expect((await svc.mySubscription('sub_theirs', { userId: 'staff_1', staff: true })).id).toBe('sub_theirs');
  });

  it('pauses the owner\'s subscription without moving the next run', async () => {
    const svc = service([mine]);
    const paused = await svc.setPausedByOwner('sub_mine', true, { userId: 'user_1', staff: false });
    expect(paused.paused).toBe(true);
    expect(paused.nextRunAt).toBe(mine.nextRunAt);
  });

  it('resumes a paused subscription', async () => {
    const svc = service([{ ...mine, paused: true }]);
    const resumed = await svc.setPausedByOwner('sub_mine', false, { userId: 'user_1', staff: false });
    expect(resumed.paused).toBe(false);
  });

  it('refuses to let a customer pause another customer\'s subscription', async () => {
    const svc = service([theirs]);
    await expect(
      svc.setPausedByOwner('sub_theirs', true, { userId: 'user_1', staff: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
