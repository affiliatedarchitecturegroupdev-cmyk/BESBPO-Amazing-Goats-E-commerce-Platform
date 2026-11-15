import { describe, it, expect } from 'vitest';
import { CreditLimitsService } from './credit-limits.service';
import { InMemoryCreditLimitsStore } from './credit-limits.store';
import { CreditRuleError } from './credit-approval.rules';
import type { TierInput } from './tiering';

const clean: TierInput = {
  currentTier: 'probation', completedOrders: 10, monthsClean: 3, onTimeRate: 0.97,
  avgWeeklySpendCents: 5_000_000, maxDaysPastDue: 0, bureauRisk: 'low',
  entityType: 'company', turnoverDeclaredCents: 500_000_000,
};

// A weekly spend high enough that the standard limit (two weeks) exceeds the
// approval threshold, so the two-approver rule applies.
const large: TierInput = { ...clean, avgWeeklySpendCents: 20_000_000 };

function service(): CreditLimitsService {
  return new CreditLimitsService(new InMemoryCreditLimitsStore());
}

describe('CreditLimitsService', () => {
  it('proposes a tier from evaluateTier, with nothing in force yet', async () => {
    const svc = service();
    const proposed = await svc.propose('org-1', clean, 'system');
    expect(proposed.tier).toBe('standard');
    expect(proposed.limitCents).toBe(10_000_000);
    expect(proposed.status).toBe('proposed');
  });

  it('approves a large limit only after two distinct people', async () => {
    const svc = service();
    await svc.propose('org-1', large, 'system');

    const first = await svc.approve('org-1', 'alice');
    expect(first.status).toBe('proposed'); // above the threshold, still needs the second

    const second = await svc.secondApproval('org-1', 'bob');
    expect(second.status).toBe('approved');
    expect(second.secondApprover).toBe('bob');
  });

  it('does not let the same person supply both approvals', async () => {
    const svc = service();
    await svc.propose('org-1', large, 'system');
    await svc.approve('org-1', 'alice');
    await expect(svc.secondApproval('org-1', 'alice')).rejects.toThrow(CreditRuleError);
  });

  it('approves a small limit with one approver', async () => {
    const svc = service();
    await svc.propose('org-1', { ...clean, avgWeeklySpendCents: 500_000 }, 'system');
    const approved = await svc.approve('org-1', 'alice');
    expect(approved.status).toBe('approved');
    expect(approved.secondApprover).toBeUndefined();
  });

  it('reports a missing org rather than inventing a limit', async () => {
    await expect(service().get('nope')).rejects.toThrow(/no credit limit/);
  });
});
