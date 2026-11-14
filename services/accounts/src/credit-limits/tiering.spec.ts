import { describe, it, expect } from 'vitest';
import { evaluateTier, TierInput } from './tiering';

const base: TierInput = { currentTier: 'probation', completedOrders: 10, monthsClean: 3, onTimeRate: 0.97, avgWeeklySpendCents: 5_000_000,
  maxDaysPastDue: 0, bureauRisk: 'low', entityType: 'company', turnoverDeclaredCents: 500_000_000 };

describe('credit tiering', () => {
  it('upgrades a clean payer from probation to standard', () => {
    const r = evaluateTier(base);
    expect(r.tier).toBe('standard'); expect(r.termsDays).toBe(14); expect(r.limitCents).toBe(10_000_000);
  });
  it('drops a tier at 14 days past due', () => {
    expect(evaluateTier({ ...base, currentTier: 'standard', maxDaysPastDue: 15 }).tier).toBe('probation');
  });
  it('sends 30+ days past due back to prepay', () => {
    expect(evaluateTier({ ...base, currentTier: 'preferred', maxDaysPastDue: 31 }).tier).toBe('new');
  });
  it('keeps high bureau risk on prepay', () => {
    expect(evaluateTier({ ...base, bureauRisk: 'high' }).tier).toBe('new');
  });
  it('caps sole proprietors at probation pending NCA review', () => {
    const r = evaluateTier({ ...base, entityType: 'sole_proprietor' });
    expect(r.tier).toBe('probation'); expect(r.ncaReview).toBe(true);
  });
  it('flags large limits for approval', () => {
    expect(evaluateTier({ ...base, currentTier: 'standard', monthsClean: 6, onTimeRate: 0.99, avgWeeklySpendCents: 20_000_000 }).needsApproval).toBe(true);
  });
});
