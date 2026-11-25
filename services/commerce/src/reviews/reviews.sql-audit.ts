import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import type { ModerationAction } from './reviews.rules';
import type { ReviewAuditStore } from './reviews.service';

interface AuditRow {
  entity_id: string;
  action: string;
  actor_user_id: string | null;
  after: { reason?: string } | null;
  at: Date | string;
}

/**
 * SQL adapter over `audit.audit_log`. The table is append-only (the triggers in
 * migration 0001 reject UPDATE and DELETE), which is what a moderation trail
 * needs: a decision cannot be quietly rewritten after the fact.
 *
 * The entity is `review` and the entity id is the review uuid, so the trail is
 * read back from the same table the rest of the platform audits to.
 */
export class PgReviewAudit implements ReviewAuditStore {
  constructor(private readonly db: Db) {}

  async append(entry: {
    reviewId: string;
    action: ModerationAction;
    by: string;
    reason?: string;
    at: string;
  }): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(
        `INSERT INTO audit.audit_log (at, actor_user_id, action, entity, entity_id, after)
         VALUES ($1, $2, $3, 'review', $4, $5)`,
        [
          entry.at,
          entry.by || null,
          entry.action,
          entry.reviewId,
          entry.reason === undefined ? null : JSON.stringify({ reason: entry.reason }),
        ],
      ),
    );
  }

  async entries() {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<AuditRow>(
        `SELECT entity_id, action, actor_user_id, after, at
           FROM audit.audit_log
          WHERE entity = 'review'
          ORDER BY id`,
      ),
    );
    return rows.map((row) => ({
      reviewId: row.entity_id,
      action: row.action as ModerationAction,
      by: row.actor_user_id ?? '',
      reason: row.after?.reason,
      at: toIso(row.at),
    }));
  }
}
