import { describe, it, expect } from 'vitest';
import {
  DUNNING_OFFSETS,
  HOLD_STANDING_ORDERS_AT_DAYS,
  addDays,
  ageingBucket,
  daysPastDue,
  dueActions,
  dunningSchedule,
  shouldHoldStandingOrders,
} from './dunning.rules';

describe('dunning schedule', () => {
  it('places each step at its documented offset from the due date', () => {
    expect(DUNNING_OFFSETS).toEqual({
      reminder_pre: -3, due_notice: 0, reminder_1: 1, call_7: 7, hold_14: 14, demand_30: 30,
    });
  });

  it('schedules all six steps, in date order', () => {
    const plan = dunningSchedule('inv-1', '2025-11-14');
    expect(plan.map((a) => a.step)).toEqual([
      'reminder_pre', 'due_notice', 'reminder_1', 'call_7', 'hold_14', 'demand_30',
    ]);
    expect(plan[0].scheduledAt).toBe('2025-11-11');
    expect(plan[5].scheduledAt).toBe('2025-12-14');
  });

  it('selects only the steps whose date has arrived', () => {
    const plan = dunningSchedule('inv-1', '2025-11-14');
    const asOf = '2025-11-22';
    expect(dueActions(plan, asOf).map((a) => a.step)).toEqual([
      'reminder_pre', 'due_notice', 'reminder_1', 'call_7',
    ]);
  });

  it('holds standing orders at day 14, not before', () => {
    expect(HOLD_STANDING_ORDERS_AT_DAYS).toBe(14);
    expect(shouldHoldStandingOrders(13)).toBe(false);
    expect(shouldHoldStandingOrders(14)).toBe(true);
  });

  it('computes days past due across a month boundary', () => {
    expect(daysPastDue('2025-11-14', '2025-11-28')).toBe(14);
    expect(daysPastDue('2025-11-14', '2025-11-11')).toBe(-3);
  });

  it('adds days as a calendar date, in UTC', () => {
    expect(addDays('2025-11-30', 1)).toBe('2025-12-01');
    expect(addDays('2025-01-01', -3)).toBe('2024-12-29');
  });

  it('buckets overdue amounts for the statement', () => {
    expect(ageingBucket(0)).toBe('current');
    expect(ageingBucket(30)).toBe('1-30');
    expect(ageingBucket(31)).toBe('31-60');
    expect(ageingBucket(61)).toBe('61-90');
    expect(ageingBucket(91)).toBe('90+');
  });
});
