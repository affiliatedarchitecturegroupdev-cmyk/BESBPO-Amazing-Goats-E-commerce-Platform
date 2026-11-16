import { describe, it, expect } from 'vitest';
import { NotFoundException } from '@nestjs/common';
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
