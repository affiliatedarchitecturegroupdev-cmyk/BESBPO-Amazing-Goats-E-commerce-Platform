import { describe, it, expect } from 'vitest';
import {
  CreditProposal,
  CreditRuleError,
  addSecondApproval,
  approveCreditProposal,
  needsSecondApprover,
  rejectCreditProposal,
} from './credit-approval.rules';
import { CREDIT_APPROVAL_THRESHOLD_CENTS } from './tiering';

const proposal = (limitCents: number, proposedBy = 'system'): CreditProposal => ({
  orgId: 'org-1',
  tier: 'standard',
  termsDays: 14,
  limitCents,
  reasons: ['3 clean months'],
  ncaReview: false,
  proposedBy,
  status: 'proposed',
});

describe('credit approval rules', () => {
  it('sets the threshold from the tiering function, so there is one definition', () => {
    expect(CREDIT_APPROVAL_THRESHOLD_CENTS).toBe(10_000_000);
  });

  it('only needs a second approver above the limit, not at it', () => {
    expect(needsSecondApprover(CREDIT_APPROVAL_THRESHOLD_CENTS)).toBe(false);
    expect(needsSecondApprover(CREDIT_APPROVAL_THRESHOLD_CENTS + 1)).toBe(true);
  });

  it('approves a small limit with a single approver', () => {
    const approved = approveCreditProposal(proposal(500_000), 'alice');
    expect(approved.status).toBe('approved');
    expect(approved.approvedBy).toBe('alice');
    expect(approved.secondApprover).toBeUndefined();
  });

  it('leaves a large limit proposed until a second approver confirms', () => {
    const first = approveCreditProposal(proposal(20_000_000), 'alice');
    expect(first.status).toBe('proposed');
    expect(first.approvedBy).toBe('alice');

    const second = addSecondApproval(first, 'bob');
    expect(second.status).toBe('approved');
    expect(second.secondApprover).toBe('bob');
  });

  it('rejects self-approval by the proposer', () => {
    expect(() => approveCreditProposal(proposal(500_000, 'alice'), 'alice')).toThrow(CreditRuleError);
  });

  it('requires the second approver to differ from the first and the proposer', () => {
    const first = approveCreditProposal(proposal(20_000_000, 'system'), 'alice');
    expect(() => addSecondApproval(first, 'alice')).toThrow(CreditRuleError);
    expect(() => addSecondApproval({ ...first, proposedBy: 'bob' }, 'bob')).toThrow(CreditRuleError);
  });

  it('does not allow a second approval on a small limit', () => {
    expect(() => addSecondApproval(proposal(500_000), 'bob')).toThrow(CreditRuleError);
  });

  it('records the reason on a rejection', () => {
    const rejected = rejectCreditProposal(proposal(500_000), 'alice', 'insufficient documents');
    expect(rejected.status).toBe('rejected');
    expect(rejected.reasons).toContain('rejected: insufficient documents');
  });

  it('requires a reason to reject', () => {
    expect(() => rejectCreditProposal(proposal(500_000), 'alice', '  ')).toThrow(CreditRuleError);
  });
});
