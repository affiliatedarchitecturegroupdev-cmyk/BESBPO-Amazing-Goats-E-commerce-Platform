import { describe, it, expect } from 'vitest';
import { chilledMeatCycle, isOrderOpen, eggsDairyProduceCycle, ambientCutoff } from './cutoff';

describe('chilled meat cycle', () => {
  it('uses the coming Sunday 17:00 SAST', () => {
    const c = chilledMeatCycle(new Date('2026-11-11T10:00:00Z'));
    expect(c.cutoffAt.toISOString()).toBe('2026-11-15T15:00:00.000Z');
    expect(c.tradeLockAt!.toISOString()).toBe('2026-11-15T10:00:00.000Z');
    expect(c.topUpUntil!.toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(c.deliveryFrom.toISOString()).toBe('2026-11-18T04:00:00.000Z');
  });
  it('rolls to next week after the cut-off', () => {
    const c = chilledMeatCycle(new Date('2026-11-15T16:00:00Z'));
    expect(c.cutoffAt.toISOString()).toBe('2026-11-22T15:00:00.000Z');
  });
  it('trade locks before the public and can top up', () => {
    const now = new Date('2026-11-15T11:00:00Z');
    const c = chilledMeatCycle(now);
    expect(isOrderOpen(c, now, 'public')).toBe(true);
    expect(isOrderOpen(c, now, 'trade')).toBe(false);
    expect(isOrderOpen(c, now, 'trade', true)).toBe(true);
  });
});
describe('other classes', () => {
  it('eggs close 48 hours before the route day', () => {
    const c = eggsDairyProduceCycle(new Date('2026-11-18T04:00:00Z'));
    expect(c.cutoffAt.toISOString()).toBe('2026-11-16T04:00:00.000Z');
  });
  it('ambient cut-off is 15:00 SAST', () => {
    expect(ambientCutoff(new Date('2026-11-11T08:00:00Z')).toISOString()).toBe('2026-11-11T13:00:00.000Z');
    expect(ambientCutoff(new Date('2026-11-11T14:00:00Z')).toISOString()).toBe('2026-11-12T13:00:00.000Z');
  });
});
