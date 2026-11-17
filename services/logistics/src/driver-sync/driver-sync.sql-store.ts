import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { DriverEvent, DriverEventType } from './driver-sync.types';
import { SyncEventStore } from './driver-sync.store';

interface EventRow {
  external_id: string;
  device_id: string;
  driver_ref: string | null;
  type: DriverEventType;
  stop_ref: string;
  occurred_at: Date | string;
  payload: Record<string, unknown>;
  received_at: Date | string;
  applied: boolean;
}

const COLUMNS =
  'external_id, device_id, driver_ref, type, stop_ref, occurred_at, payload, received_at, applied';

function toEvent(row: EventRow): DriverEvent {
  return {
    id: row.external_id,
    deviceId: row.device_id,
    ...(row.driver_ref ? { driverId: row.driver_ref } : {}),
    type: row.type,
    stopId: row.stop_ref,
    occurredAt: toIso(row.occurred_at),
    payload: row.payload,
    receivedAt: toIso(row.received_at),
    applied: row.applied,
  };
}

/**
 * SQL adapter over `logistics.sync_events`. The event id is the client-generated
 * UUID, so the table's `external_id` carries the domain id (`e1`); the uuid is
 * generated on insert.
 */
export class PgSyncEventStore implements SyncEventStore {
  constructor(private readonly db: Db) {}

  async seen(id: string): Promise<boolean> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<{ present: boolean }>(
        `SELECT true AS present FROM logistics.sync_events WHERE external_id = $1`,
        [id],
      ),
    );
    return rows.length > 0;
  }

  async insert(event: DriverEvent): Promise<DriverEvent> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<EventRow>(
        `INSERT INTO logistics.sync_events
           (external_id, device_id, driver_ref, type, stop_ref, occurred_at, payload, received_at, applied)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, now()), $9)
         ON CONFLICT (external_id) DO UPDATE SET applied = EXCLUDED.applied
         RETURNING ${COLUMNS}`,
        [
          event.id,
          event.deviceId,
          event.driverId ?? null,
          event.type,
          event.stopId,
          event.occurredAt,
          event.payload,
          event.receivedAt ?? null,
          event.applied ?? false,
        ],
      ),
    );
    return toEvent(rows[0]);
  }

  async list(): Promise<DriverEvent[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<EventRow>(`SELECT ${COLUMNS} FROM logistics.sync_events ORDER BY occurred_at`),
    );
    return rows.map(toEvent);
  }

  async markApplied(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`UPDATE logistics.sync_events SET applied = true WHERE external_id = ANY($1)`, [
        ids,
      ]),
    );
  }
}
