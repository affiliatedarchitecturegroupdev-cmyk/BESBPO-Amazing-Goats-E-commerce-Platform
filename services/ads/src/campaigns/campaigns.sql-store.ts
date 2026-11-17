import type { Db } from '@ag/db';
import { currentSession, toCents, toIsoOrUndefined } from '@ag/db';
import { Campaign, CampaignStatus, Pricing, Targeting } from './campaign-rules';
import { CampaignsStore } from './campaigns.store';

interface CampaignRow {
  id: string;
  advertiser_org: string;
  name: string;
  goal: string | null;
  budget_cents: string | number;
  spent_cents: string | number;
  pricing: Pricing;
  bid_cents: string | number | null;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  status: CampaignStatus;
  targeting: Targeting | null;
  submitted_at: Date | string | null;
  reviewed_by_ref: string | null;
  decided_at: Date | string | null;
  decision_reason: string | null;
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    advertiserOrgId: row.advertiser_org,
    name: row.name,
    goal: row.goal ?? '',
    budgetCents: toCents(row.budget_cents),
    spentCents: toCents(row.spent_cents),
    pricing: row.pricing,
    bidCents: row.bid_cents === null ? undefined : toCents(row.bid_cents),
    startsAt: toIsoOrUndefined(row.starts_at),
    endsAt: toIsoOrUndefined(row.ends_at),
    status: row.status,
    targeting: row.targeting ?? {},
    submittedAt: toIsoOrUndefined(row.submitted_at),
    reviewedBy: row.reviewed_by_ref ?? undefined,
    decidedAt: toIsoOrUndefined(row.decided_at),
    decisionReason: row.decision_reason ?? undefined,
  };
}

// The domain id is a uuid; the advertiser is a domain organisation id carried in
// `advertiser_org_ref`, so the uuid column is resolved from `identity.orgs`.
const COLUMNS = `c.id, COALESCE(c.advertiser_org_ref, c.advertiser_org_id::text) AS advertiser_org,
  c.name, c.goal, c.budget_cents, c.spent_cents, c.pricing, c.bid_cents, c.starts_at, c.ends_at,
  c.status, c.targeting, c.submitted_at, c.reviewed_by_ref, c.decided_at, c.decision_reason`;

/**
 * SQL adapter over `ads.campaigns`. The advertiser is a domain organisation id,
 * so it is carried in `advertiser_org_ref` and the uuid column is resolved from
 * `identity.orgs.external_id`. Every query runs in an RLS session, so an
 * advertiser sees only their own campaigns and a staff session sees all.
 */
export class PgCampaignsStore implements CampaignsStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<Campaign[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CampaignRow>(`SELECT ${COLUMNS} FROM ads.campaigns c`),
    );
    return rows.map(toCampaign);
  }

  async get(id: string): Promise<Campaign | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CampaignRow>(`SELECT ${COLUMNS} FROM ads.campaigns c WHERE c.id = $1`, [id]),
    );
    return rows[0] ? toCampaign(rows[0]) : undefined;
  }

  async insert(campaign: Campaign): Promise<Campaign> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CampaignRow>(
        `WITH upserted AS (
           INSERT INTO ads.campaigns
             (id, advertiser_org_id, advertiser_org_ref, name, goal, budget_cents, spent_cents,
              pricing, bid_cents, starts_at, ends_at, status, targeting, submitted_at,
              reviewed_by_ref, decided_at, decision_reason)
           VALUES ($1, (SELECT id FROM identity.orgs WHERE external_id = $2), $2, $3, $4, $5, $6,
                   $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           ON CONFLICT (id) DO UPDATE SET
             advertiser_org_id = EXCLUDED.advertiser_org_id, advertiser_org_ref = EXCLUDED.advertiser_org_ref,
             name = EXCLUDED.name, goal = EXCLUDED.goal, budget_cents = EXCLUDED.budget_cents,
             spent_cents = EXCLUDED.spent_cents, pricing = EXCLUDED.pricing, bid_cents = EXCLUDED.bid_cents,
             starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at, status = EXCLUDED.status,
             targeting = EXCLUDED.targeting, submitted_at = EXCLUDED.submitted_at,
             reviewed_by_ref = EXCLUDED.reviewed_by_ref, decided_at = EXCLUDED.decided_at,
             decision_reason = EXCLUDED.decision_reason
           RETURNING *
         )
         SELECT ${COLUMNS} FROM upserted c`,
        [
          campaign.id,
          campaign.advertiserOrgId,
          campaign.name,
          campaign.goal,
          campaign.budgetCents,
          campaign.spentCents,
          campaign.pricing,
          campaign.bidCents ?? null,
          campaign.startsAt ?? null,
          campaign.endsAt ?? null,
          campaign.status,
          JSON.stringify(campaign.targeting ?? {}),
          campaign.submittedAt ?? null,
          campaign.reviewedBy ?? null,
          campaign.decidedAt ?? null,
          campaign.decisionReason ?? null,
        ],
      ),
    );
    return toCampaign(rows[0]);
  }

  async replace(campaign: Campaign): Promise<Campaign> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CampaignRow>(
        `UPDATE ads.campaigns c SET
           name = $2, goal = $3, budget_cents = $4, spent_cents = $5, pricing = $6, bid_cents = $7,
           starts_at = $8, ends_at = $9, status = $10, targeting = $11, submitted_at = $12,
           reviewed_by_ref = $13, decided_at = $14, decision_reason = $15
         WHERE c.id = $1
         RETURNING ${COLUMNS}`,
        [
          campaign.id,
          campaign.name,
          campaign.goal,
          campaign.budgetCents,
          campaign.spentCents,
          campaign.pricing,
          campaign.bidCents ?? null,
          campaign.startsAt ?? null,
          campaign.endsAt ?? null,
          campaign.status,
          JSON.stringify(campaign.targeting ?? {}),
          campaign.submittedAt ?? null,
          campaign.reviewedBy ?? null,
          campaign.decidedAt ?? null,
          campaign.decisionReason ?? null,
        ],
      ),
    );
    if (!rows[0]) throw new Error(`campaign ${campaign.id} not found`);
    return toCampaign(rows[0]);
  }
}
