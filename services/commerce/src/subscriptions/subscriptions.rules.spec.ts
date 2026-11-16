import { describe, it, expect } from 'vitest';
import type { CycleRecord } from '../cycles/cycle-engine';
import {
  SubscriptionError,
  advance,
  assertValidStandingOrder,
  dueStandingOrders,
  dueSubscriptions,
  isStandingOrderDue,
  isSubscriptionDue,
  nextRunAt,
  nextStandingRun,
  openCycleFor,
  pause,
  resume,
} from './subscriptions.rules';
import { StandingOrder, Subscription } from './subscriptions.types';

const THIS_WEEK: CycleRecord = {
  id: 'chilled_meat:2026-11-15T15:00:00.000Z',
  productClass: 'chilled_meat',
  cutoffAt: '2026-11-15T15:00:00.000Z',
  deliveryFrom: '2026-11-18T04:00:00.000Z',
  deliveryTo: '2026-11-20T16:00:00.000Z',
  status: 'open',
};
const NEXT_WEEK: CycleRecord = { ...THIS_WEEK, id: 'chilled_meat:2026-11-22T15:00:00.000Z', cutoffAt: '2026-11-22T15:00:00.000Z' };

function sub(over: Partial<Subscription> = {}): Subscription {
  return {
    id: 'sub_1',
    customerUserId: 'user_1',
    bundleId: 'bundle_braai',
    cadence: 'weekly',
    nextRunAt: '2026-11-11T08:00:00.000Z',
    paused: false,
    ...over,
  };
}

function standing(over: Partial<StandingOrder> = {}): StandingOrder {
  return {
    id: 'so_1',
    orgId: 'org_1',
    dayOfWeek: 3, // Wednesday
    deliveryWindow: '06:00-10:00',
    pausedUntil: null,
    active: true,
    lines: [{ variantId: 'var_1', qty: 10 }],
    ...over,
  };
}

describe('nextRunAt', () => {
  it('adds 7 days for weekly and 14 for fortnightly', () => {
    const from = new Date('2026-11-11T08:00:00.000Z');
    expect(nextRunAt('weekly', from).toISOString()).toBe('2026-11-18T08:00:00.000Z');
    expect(nextRunAt('fortnightly', from).toISOString()).toBe('2026-11-25T08:00:00.000Z');
  });
  it('advances monthly by calendar and clamps to the last day of a short month', () => {
    expect(nextRunAt('monthly', new Date('2026-01-31T08:00:00.000Z')).toISOString()).toBe('2026-02-28T08:00:00.000Z');
    expect(nextRunAt('monthly', new Date('2026-03-15T08:00:00.000Z')).toISOString()).toBe('2026-04-15T08:00:00.000Z');
  });
});

describe('isSubscriptionDue', () => {
  it('is due when nextRunAt has passed and not paused', () => {
    expect(isSubscriptionDue(sub(), new Date('2026-11-11T08:00:00.000Z'))).toBe(true);
    expect(isSubscriptionDue(sub(), new Date('2026-11-10T08:00:00.000Z'))).toBe(false);
    expect(isSubscriptionDue(sub({ paused: true }), new Date('2026-11-11T08:00:00.000Z'))).toBe(false);
  });
});

describe('openCycleFor', () => {
  it('takes the soonest still-open cycle', () => {
    expect(openCycleFor([NEXT_WEEK, THIS_WEEK], new Date('2026-11-11T08:00:00.000Z'))?.id).toBe(THIS_WEEK.id);
  });
  it('skips cycles whose cut-off has passed', () => {
    expect(openCycleFor([THIS_WEEK, NEXT_WEEK], new Date('2026-11-15T16:00:00.000Z'))?.id).toBe(NEXT_WEEK.id);
  });
});

describe('advance', () => {
  it('moves the run on by one cadence and records a skip', () => {
    const skipped = advance(sub(), new Date('2026-11-11T08:00:00.000Z'), true);
    expect(skipped.nextRunAt).toBe('2026-11-18T08:00:00.000Z');
    expect(skipped.skipped).toEqual(['2026-11-11T08:00:00.000Z']);
  });
  it('advances without recording a skip on a normal run', () => {
    const run = advance(sub(), new Date('2026-11-11T08:00:00.000Z'), false);
    expect(run.skipped).toBeUndefined();
    expect(run.nextRunAt).toBe('2026-11-18T08:00:00.000Z');
  });
});

describe('pause and resume', () => {
  it('toggles the paused flag', () => {
    expect(pause(sub()).paused).toBe(true);
    expect(resume(sub({ paused: true })).paused).toBe(false);
  });
});

describe('dueSubscriptions', () => {
  it('returns each due subscription with the cycle it would land in', () => {
    const at = new Date('2026-11-11T09:00:00.000Z');
    const due = dueSubscriptions([sub(), sub({ id: 'sub_2', nextRunAt: '2026-12-01T08:00:00.000Z' })], [THIS_WEEK], at);
    expect(due).toHaveLength(1);
    expect(due[0].schedule.id).toBe('sub_1');
    expect(due[0].cycle?.id).toBe(THIS_WEEK.id);
  });
});

describe('isStandingOrderDue', () => {
  it('is due on its weekday after the window opens, SAST', () => {
    // 2026-11-11 is a Wednesday. 06:00 SAST = 04:00 UTC.
    expect(isStandingOrderDue(standing(), new Date('2026-11-11T05:00:00.000Z'))).toBe(true);
    expect(isStandingOrderDue(standing(), new Date('2026-11-11T03:00:00.000Z'))).toBe(false);
    expect(isStandingOrderDue(standing(), new Date('2026-11-12T05:00:00.000Z'))).toBe(false); // Thursday
  });
  it('is not due while paused or inactive', () => {
    expect(isStandingOrderDue(standing({ pausedUntil: '2026-11-30' }), new Date('2026-11-11T05:00:00.000Z'))).toBe(false);
    expect(isStandingOrderDue(standing({ active: false }), new Date('2026-11-11T05:00:00.000Z'))).toBe(false);
  });
});

describe('nextStandingRun', () => {
  it('returns the next matching weekday at the window start', () => {
    // From Tuesday 2026-11-10, the next Wednesday 06:00 SAST is 2026-11-11T04:00:00Z.
    const next = nextStandingRun(standing(), new Date('2026-11-10T12:00:00.000Z'));
    expect(next?.toISOString()).toBe('2026-11-11T04:00:00.000Z');
  });
  it('skips a run inside the pause', () => {
    const next = nextStandingRun(standing({ pausedUntil: '2026-11-11' }), new Date('2026-11-10T12:00:00.000Z'));
    expect(next?.toISOString()).toBe('2026-11-18T04:00:00.000Z');
  });
  it('is null for an inactive standing order', () => {
    expect(nextStandingRun(standing({ active: false }), new Date('2026-11-10T12:00:00.000Z'))).toBeNull();
  });
});

describe('dueStandingOrders', () => {
  it('returns each due standing order with its cycle', () => {
    const due = dueStandingOrders([standing()], [THIS_WEEK], new Date('2026-11-11T05:00:00.000Z'));
    expect(due).toHaveLength(1);
    expect(due[0].cycle?.id).toBe(THIS_WEEK.id);
  });
});

describe('assertValidStandingOrder', () => {
  it('rejects an out-of-range weekday', () => {
    expect(() => assertValidStandingOrder(standing({ dayOfWeek: 7 }))).toThrow(SubscriptionError);
  });
  it('rejects an empty or non-positive basket', () => {
    expect(() => assertValidStandingOrder(standing({ lines: [] }))).toThrow(/at least one line/);
    expect(() => assertValidStandingOrder(standing({ lines: [{ variantId: 'v', qty: 0 }] }))).toThrow(/positive/);
  });
});
