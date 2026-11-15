import type { Db } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import { DunningStep } from './dunning.rules';
import { CollectionActionRecord } from './collections.types';
import { CollectionsStore } from './collections.store';

interface CollectionActionRow {
  id: string;
  invoice_id: string;
  step: DunningStep;
  scheduled_at: Date | string;
  done_at: Date | string | null;
  by_user: string | null;
}

function toAction(row: CollectionActionRow): CollectionActionRecord {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    step: row.step,
    scheduledAt: toIso(row.scheduled_at),
    doneAt: toIsoOrUndefined(row.done_at),
    byUser: row.by_user ?? undefined,
  };
}

const COLUMNS = 'id, invoice_id, step, scheduled_at, done_at, by_user';

/** SQL adapter over `accounts.collection_actions`; every query runs in an RLS session. */
export class PgCollectionsStore implements CollectionsStore {
  constructor(private readonly db: Db) {}

  async all(): Promise<CollectionActionRecord[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CollectionActionRow>(`SELECT ${COLUMNS} FROM accounts.collection_actions ORDER BY scheduled_at`),
    );
    return rows.map(toAction);
  }

  async get(id: string): Promise<CollectionActionRecord | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CollectionActionRow>(`SELECT ${COLUMNS} FROM accounts.collection_actions WHERE id = $1`, [id]),
    );
    return rows[0] ? toAction(rows[0]) : undefined;
  }

  async insertMany(actions: CollectionActionRecord[]): Promise<CollectionActionRecord[]> {
    if (actions.length === 0) return [];
    await this.db.withSession(currentSession(), async (tx) => {
      for (const action of actions) {
        await tx.query(
          `INSERT INTO accounts.collection_actions (id, invoice_id, step, scheduled_at, done_at, by_user)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (id) DO NOTHING`,
          [action.id, action.invoiceId, action.step, action.scheduledAt, action.doneAt ?? null, action.byUser ?? null],
        );
      }
    });
    return actions;
  }

  async replace(action: CollectionActionRecord): Promise<CollectionActionRecord> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<CollectionActionRow>(
        `UPDATE accounts.collection_actions SET done_at = $2, by_user = $3 WHERE id = $1 RETURNING ${COLUMNS}`,
        [action.id, action.doneAt ?? null, action.byUser ?? null],
      ),
    );
    if (!rows[0]) throw new Error(`collection action ${action.id} not found`);
    return toAction(rows[0]);
  }
}
