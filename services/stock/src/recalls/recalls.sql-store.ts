import type { Db } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import { Recall } from './recalls.domain';
import { RecallStore } from './recalls.store';

interface RecallRow {
  external_id: string;
  batch_ref: string | null;
  reason: string;
  opened_by_ref: string | null;
  opened_at: Date | string;
  closed_at: Date | string | null;
  affected_order_ids: string[] | null;
}

const COLUMNS = `rc.external_id, b.external_id AS batch_ref, rc.reason, rc.opened_by_ref,
  rc.opened_at, rc.closed_at, rc.affected_order_ids`;

const FROM = 'inventory.recalls rc LEFT JOIN inventory.batches b ON b.id = rc.batch_id';

function toRecall(row: RecallRow): Recall {
  const closedAt = toIsoOrUndefined(row.closed_at);
  return {
    id: row.external_id,
    batchId: row.batch_ref ?? '',
    reason: row.reason,
    openedBy: row.opened_by_ref ?? '',
    openedAt: toIso(row.opened_at),
    ...(closedAt ? { closedAt } : {}),
    affectedOrderIds: row.affected_order_ids ?? [],
  };
}

/** SQL adapter over `inventory.recalls`; the batch is joined to return its domain id. */
export class PgRecallStore implements RecallStore {
  constructor(private readonly db: Db) {}

  async list(): Promise<Recall[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RecallRow>(`SELECT ${COLUMNS} FROM ${FROM} ORDER BY rc.opened_at DESC`),
    );
    return rows.map(toRecall);
  }

  async get(id: string): Promise<Recall | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RecallRow>(`SELECT ${COLUMNS} FROM ${FROM} WHERE rc.external_id = $1`, [id]),
    );
    return rows[0] ? toRecall(rows[0]) : undefined;
  }

  async insert(recall: Recall): Promise<Recall> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RecallRow>(
        `WITH upserted AS (
           INSERT INTO inventory.recalls
             (external_id, batch_id, reason, opened_by_ref, opened_at, closed_at, affected_order_ids)
           SELECT $1, b.id, $3, $4, $5, $6, $7 FROM inventory.batches b WHERE b.external_id = $2
           ON CONFLICT (external_id) DO UPDATE SET
             reason = EXCLUDED.reason, closed_at = EXCLUDED.closed_at,
             affected_order_ids = EXCLUDED.affected_order_ids
           RETURNING *
         )
         SELECT ${COLUMNS} FROM upserted rc LEFT JOIN inventory.batches b ON b.id = rc.batch_id`,
        [
          recall.id,
          recall.batchId,
          recall.reason,
          recall.openedBy,
          recall.openedAt,
          recall.closedAt ?? null,
          recall.affectedOrderIds,
        ],
      ),
    );
    return toRecall(rows[0]);
  }

  async close(id: string, closedAt: string): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`UPDATE inventory.recalls SET closed_at = $2 WHERE external_id = $1`, [
        id,
        closedAt,
      ]),
    );
  }
}
