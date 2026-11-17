import type { Db } from '@ag/db';
import { currentSession, toIsoOrUndefined } from '@ag/db';
import { Creative, ReviewStatus, SlotCode } from '../campaigns/campaign-rules';
import { CreativesStore } from './creatives.store';

interface CreativeRow {
  id: string;
  campaign_id: string;
  slot_code: SlotCode;
  asset_url: string;
  headline: string | null;
  destination_url: string | null;
  claims_evidence_url: string | null;
  review_status: ReviewStatus;
  reviewed_by_ref: string | null;
  review_notes: string | null;
  reviewed_at: Date | string | null;
}

function toCreative(row: CreativeRow): Creative {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    slotCode: row.slot_code,
    assetUrl: row.asset_url,
    headline: row.headline ?? undefined,
    destinationUrl: row.destination_url ?? undefined,
    claimsEvidenceUrl: row.claims_evidence_url ?? undefined,
    reviewStatus: row.review_status,
    reviewedBy: row.reviewed_by_ref ?? undefined,
    reviewNotes: row.review_notes ?? undefined,
    reviewedAt: toIsoOrUndefined(row.reviewed_at),
  };
}

const COLUMNS = `id, campaign_id, slot_code, asset_url, headline, destination_url, claims_evidence_url,
  review_status, reviewed_by_ref, review_notes, reviewed_at`;

/**
 * SQL adapter over `ads.creatives`. A creative is visible exactly when its
 * campaign is (the RLS policy tests the parent row), so an advertiser sees only
 * their own creatives and a staff session sees the whole review queue.
 */
export class PgCreativesStore implements CreativesStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<Creative[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreativeRow>(`SELECT ${COLUMNS} FROM ads.creatives`),
    );
    return rows.map(toCreative);
  }

  async get(id: string): Promise<Creative | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreativeRow>(`SELECT ${COLUMNS} FROM ads.creatives WHERE id = $1`, [id]),
    );
    return rows[0] ? toCreative(rows[0]) : undefined;
  }

  async byCampaign(campaignId: string): Promise<Creative[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreativeRow>(`SELECT ${COLUMNS} FROM ads.creatives WHERE campaign_id = $1`, [
        campaignId,
      ]),
    );
    return rows.map(toCreative);
  }

  async insert(creative: Creative): Promise<Creative> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreativeRow>(
        `INSERT INTO ads.creatives
           (id, campaign_id, slot_code, asset_url, headline, destination_url, claims_evidence_url,
            review_status, reviewed_by_ref, review_notes, reviewed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING ${COLUMNS}`,
        [
          creative.id,
          creative.campaignId,
          creative.slotCode,
          creative.assetUrl,
          creative.headline ?? null,
          creative.destinationUrl ?? null,
          creative.claimsEvidenceUrl ?? null,
          creative.reviewStatus,
          creative.reviewedBy ?? null,
          creative.reviewNotes ?? null,
          creative.reviewedAt ?? null,
        ],
      ),
    );
    return toCreative(rows[0]);
  }

  async replace(creative: Creative): Promise<Creative> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CreativeRow>(
        `UPDATE ads.creatives SET
           slot_code = $2, asset_url = $3, headline = $4, destination_url = $5,
           claims_evidence_url = $6, review_status = $7, reviewed_by_ref = $8,
           review_notes = $9, reviewed_at = $10
         WHERE id = $1
         RETURNING ${COLUMNS}`,
        [
          creative.id,
          creative.slotCode,
          creative.assetUrl,
          creative.headline ?? null,
          creative.destinationUrl ?? null,
          creative.claimsEvidenceUrl ?? null,
          creative.reviewStatus,
          creative.reviewedBy ?? null,
          creative.reviewNotes ?? null,
          creative.reviewedAt ?? null,
        ],
      ),
    );
    if (!rows[0]) throw new Error(`creative ${creative.id} not found`);
    return toCreative(rows[0]);
  }
}
