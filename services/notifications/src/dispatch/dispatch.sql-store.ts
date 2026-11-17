import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { Channel } from '../templates/template';
import { DispatchLog, DispatchRecord, DispatchStatus } from './dispatch';

interface MessageRow {
  id: string;
  channel: Channel;
  template_key: string;
  contact_ref: string;
  status: DispatchStatus;
  reason: string;
  provider_ref: string | null;
  at: Date | string;
}

function toRecord(row: MessageRow): DispatchRecord {
  return {
    id: row.id,
    channel: row.channel,
    templateKey: row.template_key,
    contactId: row.contact_ref,
    status: row.status,
    reason: row.reason,
    providerRef: row.provider_ref ?? undefined,
    at: toIso(row.at),
  };
}

const COLUMNS = `id, channel, template_key, contact_ref, status, reason, provider_ref, at`;

/**
 * SQL adapter over `notifications.messages`. Every outcome is written once with
 * its reason (`sent`, `suppressed`, `failed`), so the dispatch log is the audit
 * trail for outbound messages. The table is a support-only record, so a
 * non-staff session sees nothing (default deny); `record` writes under the same
 * session the send ran in.
 */
export class PgDispatchLog implements DispatchLog {
  constructor(private readonly db: Db) {}

  async record(entry: DispatchRecord): Promise<DispatchRecord> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<MessageRow>(
        `INSERT INTO notifications.messages
           (id, channel, template_key, contact_ref, status, reason, provider_ref, at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING ${COLUMNS}`,
        [
          entry.id,
          entry.channel,
          entry.templateKey,
          entry.contactId,
          entry.status,
          entry.reason,
          entry.providerRef ?? null,
          entry.at,
        ],
      ),
    );
    return toRecord(rows[0]);
  }

  async list(): Promise<DispatchRecord[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<MessageRow>(`SELECT ${COLUMNS} FROM notifications.messages ORDER BY at`),
    );
    return rows.map(toRecord);
  }
}
