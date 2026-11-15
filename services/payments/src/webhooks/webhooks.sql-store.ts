import type { Db } from '@ag/db';
import { currentSession, toIso, toIsoOrUndefined } from '@ag/db';
import { ProviderEventRecord, WebhookStore } from './webhooks.store';

interface EventRow {
  provider: string;
  event_id: string;
  signature_ok: boolean;
  payload: unknown;
  received_at: Date | string;
  processed_at: Date | string | null;
}

function toRecord(row: EventRow): ProviderEventRecord {
  return {
    provider: row.provider,
    eventId: row.event_id,
    signatureOk: row.signature_ok,
    payload: row.payload,
    receivedAt: toIso(row.received_at),
    processedAt: toIsoOrUndefined(row.processed_at),
  };
}

/**
 * SQL adapter over `payments.provider_events`. Deduplication is the unique key on
 * `(provider, event_id)`: the insert does nothing on conflict, so a retried
 * delivery is stored once and reported as a duplicate.
 */
export class PgWebhookStore implements WebhookStore {
  constructor(private readonly db: Db) {}

  async record(event: ProviderEventRecord): Promise<{ stored: boolean; event: ProviderEventRecord }> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<EventRow>(
        `INSERT INTO payments.provider_events
           (provider, event_id, signature_ok, payload, received_at, processed_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (provider, event_id) DO NOTHING
         RETURNING provider, event_id, signature_ok, payload, received_at, processed_at`,
        [
          event.provider,
          event.eventId,
          event.signatureOk,
          JSON.stringify(event.payload),
          event.receivedAt,
          event.processedAt ?? null,
        ],
      ),
    );
    if (rows[0]) return { stored: true, event: toRecord(rows[0]) };

    // Conflict: the row already exists, so read it back and report a duplicate.
    const existing = await this.db.withSession(currentSession(), (tx) =>
      tx.query<EventRow>(
        `SELECT provider, event_id, signature_ok, payload, received_at, processed_at
           FROM payments.provider_events WHERE provider = $1 AND event_id = $2`,
        [event.provider, event.eventId],
      ),
    );
    return { stored: false, event: toRecord(existing.rows[0]) };
  }

  async list(): Promise<ProviderEventRecord[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<EventRow>(
        `SELECT provider, event_id, signature_ok, payload, received_at, processed_at
           FROM payments.provider_events`,
      ),
    );
    return rows.map(toRecord);
  }
}
