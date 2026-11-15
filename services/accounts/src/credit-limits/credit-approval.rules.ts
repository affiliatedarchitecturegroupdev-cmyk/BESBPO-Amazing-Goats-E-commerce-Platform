import { CREDIT_APPROVAL_THRESHOLD_CENTS, Tier } from './tiering';

/**
 * A credit limit is proposed by the system and decided by a person. The rules
 * below are pure, so the workflow is testable without a database and there is
 * one definition of "large limit" and "who may approve".
 */
export type CreditDecisionStatus = 'proposed' | 'approved' | 'rejected';

/** Raised when a credit decision is not allowed. */
export class CreditRuleError extends Error {}

export interface CreditProposal {
  orgId: string;
  tier: Tier;
  termsDays: number;
  limitCents: number;
  reasons: string[];
  ncaReview: boolean;
  proposedBy: string;
  status: CreditDecisionStatus;
  approvedBy?: string;
  secondApprover?: string;
}

/** Above the threshold, a second person must approve; at or below it, one is enough. */
export function needsSecondApprover(
  limitCents: number,
  threshold: number = CREDIT_APPROVAL_THRESHOLD_CENTS,
): boolean {
  return limitCents > threshold;
}

/**
 * Record the first approval. The approver must be named, and must not be the
 * person who proposed the limit, so the system cannot approve its own proposal
 * and a user cannot approve the limit they asked for.
 */
export function approveCreditProposal(
  proposal: CreditProposal,
  approverUserId: string,
): CreditProposal {
  if (proposal.status !== 'proposed') {
    throw new CreditRuleError(`only a proposed limit can be approved, this one is ${proposal.status}`);
  }
  if (!approverUserId) throw new CreditRuleError('an approver is required');
  if (proposal.limitCents <= 0 || !Number.isInteger(proposal.limitCents)) {
    throw new CreditRuleError('a credit limit must be a positive integer number of cents');
  }
  if (proposal.proposedBy === approverUserId) {
    throw new CreditRuleError('the approver must not be the person who proposed the limit');
  }
  const needsSecond = needsSecondApprover(proposal.limitCents);
  return {
    ...proposal,
    // A large limit stays proposed until a different second person confirms it;
    // a small one is approved by this first approver alone.
    status: needsSecond ? 'proposed' : 'approved',
    approvedBy: approverUserId,
  };
}

/**
 * Add the second approval to a large limit. The second approver must differ from
 * both the proposer and the first approver, so a large limit always carries two
 * distinct people. A small limit does not need this step.
 */
export function addSecondApproval(
  proposal: CreditProposal,
  approverUserId: string,
): CreditProposal {
  if (!needsSecondApprover(proposal.limitCents)) {
    throw new CreditRuleError('a limit at or below the threshold needs a single approver');
  }
  if (proposal.status !== 'proposed') {
    throw new CreditRuleError(`a second approval only applies to a proposed limit, this one is ${proposal.status}`);
  }
  if (!proposal.approvedBy) {
    throw new CreditRuleError('a first approval is required before the second');
  }
  if (!approverUserId) throw new CreditRuleError('an approver is required');
  if (approverUserId === proposal.approvedBy || approverUserId === proposal.proposedBy) {
    throw new CreditRuleError('the second approver must differ from the proposer and the first approver');
  }
  return { ...proposal, status: 'approved', secondApprover: approverUserId };
}

/** Reject a proposal. A rejection needs a reason, so the trade customer can be told why. */
export function rejectCreditProposal(
  proposal: CreditProposal,
  approverUserId: string,
  reason: string,
): CreditProposal {
  if (proposal.status !== 'proposed') {
    throw new CreditRuleError(`only a proposed limit can be rejected, this one is ${proposal.status}`);
  }
  if (!approverUserId) throw new CreditRuleError('an approver is required');
  if (!reason.trim()) throw new CreditRuleError('a rejection needs a reason');
  return { ...proposal, status: 'rejected', reasons: [...proposal.reasons, `rejected: ${reason}`] };
}
