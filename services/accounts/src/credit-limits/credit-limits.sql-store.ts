import type { Db } from '@ag/db';
import { currentSession, toCents } from '@ag/db';
import type { Tier } from './tiering';
import { CreditProposal, CreditDecisionStatus } from './credit-approval.rules';
import { CreditLimitsStore } from './credit-limits.store';

interface CreditLimitRow {
  org_id: string;
  tier: Tier;
  terms_days: number;
  limit_cents: string | number;
  reasons: string[] | null;
  nca_review: boolean;
  proposed_by: string;
  status: CreditDecisionStatus;
  approved_by: string | null;
  second_approver: string | null;
}

function toProposal(row: CreditLimitRow): CreditProposal {
  return {
    orgId: row.org_id,
    tier: row.tier,
    termsDays: row.terms_days,
    limitCents: toCents(row.limit_cents),
    reasons: row.reasons ?? [],
    ncaReview: row.nca_review,
    proposedBy: row.proposed_by,
    status: row.status,
    approvedBy: row.approved_by ?? undefined,
    secondApprover: row.second_approver ?? undefined,
  };
}

const COLUMNS =
  'org_id, tier, terms_days, limit_cents, reasons, nca_review, proposed_by, status, approved_by, second_approver';

/** SQL adapter over `accounts.credit_limits`; every query runs in an RLS session. */
export class PgCreditLimitsStore implements CreditLimitsStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<CreditProposal[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreditLimitRow>(
        `SELECT ${COLUMNS} FROM accounts.credit_limits WHERE status <> 'rejected' ORDER BY org_id`,
      ),
    );
    return rows.map(toProposal);
  }

  async get(orgId: string): Promise<CreditProposal | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreditLimitRow>(
        `SELECT ${COLUMNS} FROM accounts.credit_limits
          WHERE org_id = $1 AND status <> 'rejected'
          ORDER BY effective_at DESC LIMIT 1`,
        [orgId],
      ),
    );
    return rows[0] ? toProposal(rows[0]) : undefined;
  }

  async upsert(proposal: CreditProposal): Promise<CreditProposal> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreditLimitRow>(
        `INSERT INTO accounts.credit_limits
           (org_id, tier, terms_days, limit_cents, reasons, nca_review, proposed_by, status, approved_by, second_approver, effective_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
         ON CONFLICT (org_id) WHERE status <> 'rejected'
         DO UPDATE SET tier = EXCLUDED.tier, terms_days = EXCLUDED.terms_days,
                       limit_cents = EXCLUDED.limit_cents, reasons = EXCLUDED.reasons,
                       nca_review = EXCLUDED.nca_review, proposed_by = EXCLUDED.proposed_by,
                       status = EXCLUDED.status, approved_by = EXCLUDED.approved_by,
                       second_approver = EXCLUDED.second_approver, effective_at = now()
         RETURNING ${COLUMNS}`,
        [
          proposal.orgId,
          proposal.tier,
          proposal.termsDays,
          proposal.limitCents,
          proposal.reasons,
          proposal.ncaReview,
          proposal.proposedBy,
          proposal.status,
          proposal.approvedBy ?? null,
          proposal.secondApprover ?? null,
        ],
      ),
    );
    return toProposal(rows[0]);
  }
}
