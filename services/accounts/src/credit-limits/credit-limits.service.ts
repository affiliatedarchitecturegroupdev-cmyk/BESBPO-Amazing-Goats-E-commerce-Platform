import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CreditLimitsStore } from './credit-limits.store';
import {
  CreditProposal,
  addSecondApproval,
  approveCreditProposal,
  rejectCreditProposal,
} from './credit-approval.rules';
import { TierInput, evaluateTier } from './tiering';

export const CREDIT_LIMITS_STORE = Symbol('CREDIT_LIMITS_STORE');

/**
 * Credit limits. The system proposes a tier and limit from `evaluateTier`; a
 * person approves. A large limit needs a second, distinct approver. The service
 * only coordinates; the decisions live in the pure rules.
 */
@Injectable()
export class CreditLimitsService {
  constructor(@Inject(CREDIT_LIMITS_STORE) private readonly store: CreditLimitsStore) {}

  async list(): Promise<CreditProposal[]> {
    return (await this.store.all()).sort((a, b) => a.orgId.localeCompare(b.orgId));
  }

  async get(orgId: string): Promise<CreditProposal> {
    const proposal = await this.store.get(orgId);
    if (!proposal) throw new NotFoundException(`no credit limit for org ${orgId}`);
    return proposal;
  }

  /**
   * Propose a tier and limit for an org from the tiering inputs. The proposal is
   * recorded as `proposed`; nothing is in force until a person approves it.
   */
  async propose(orgId: string, input: TierInput, proposedBy: string): Promise<CreditProposal> {
    const result = evaluateTier(input);
    const existing = await this.store.get(orgId);
    return this.store.upsert({
      orgId,
      tier: result.tier,
      termsDays: result.termsDays,
      limitCents: result.limitCents,
      reasons: result.reasons,
      ncaReview: result.ncaReview,
      proposedBy,
      status: 'proposed',
      // A re-proposal carries a first approval already given, but not a second:
      // the limit it approved has changed, so it must be confirmed again.
      approvedBy: existing?.status === 'proposed' ? existing.approvedBy : undefined,
    });
  }

  /** First approval. A large limit stays proposed until a second person confirms. */
  async approve(orgId: string, approverUserId: string): Promise<CreditProposal> {
    return this.store.upsert(approveCreditProposal(await this.get(orgId), approverUserId));
  }

  /** Second approval for a large limit; the approver must differ from the first. */
  async secondApproval(orgId: string, approverUserId: string): Promise<CreditProposal> {
    return this.store.upsert(addSecondApproval(await this.get(orgId), approverUserId));
  }

  /** Reject a proposal, with a reason the trade customer can be told. */
  async reject(orgId: string, approverUserId: string, reason: string): Promise<CreditProposal> {
    return this.store.upsert(rejectCreditProposal(await this.get(orgId), approverUserId, reason));
  }
}
