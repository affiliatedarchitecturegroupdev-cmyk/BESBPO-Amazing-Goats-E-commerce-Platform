import type { Db } from '@ag/db';
import { currentSession, toIso } from '@ag/db';
import { Slot } from './slots.types';
import { SlotStore } from './slots.store';

interface SlotRow {
  external_id: string;
  route_ref: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  capacity: number;
  booked: number;
  early_window: boolean;
}

const COLUMNS =
  's.external_id, r.external_id AS route_ref, s.starts_at, s.ends_at, s.capacity, s.booked, s.early_window';

function toSlot(row: SlotRow): Slot {
  return {
    id: row.external_id,
    routeId: row.route_ref ?? '',
    startsAt: toIso(row.starts_at),
    endsAt: toIso(row.ends_at),
    capacity: row.capacity,
    booked: row.booked,
    earlyWindow: row.early_window,
  };
}

const FROM = 'logistics.slots s LEFT JOIN logistics.routes r ON r.id = s.route_id';

/** SQL adapter over `logistics.slots`; the route is joined to return its domain id. */
export class PgSlotStore implements SlotStore {
  constructor(private readonly db: Db) {}

  async list(): Promise<Slot[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SlotRow>(`SELECT ${COLUMNS} FROM ${FROM} ORDER BY s.starts_at`),
    );
    return rows.map(toSlot);
  }

  async get(id: string): Promise<Slot | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SlotRow>(`SELECT ${COLUMNS} FROM ${FROM} WHERE s.external_id = $1`, [id]),
    );
    return rows[0] ? toSlot(rows[0]) : undefined;
  }

  async insert(slot: Slot): Promise<Slot> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<SlotRow>(
        `WITH upserted AS (
           INSERT INTO logistics.slots
             (external_id, route_id, starts_at, ends_at, capacity, booked, early_window)
           SELECT $1, r.id, $3, $4, $5, $6, $7 FROM logistics.routes r WHERE r.external_id = $2
           ON CONFLICT (external_id) DO UPDATE SET
             route_id = EXCLUDED.route_id, starts_at = EXCLUDED.starts_at, ends_at = EXCLUDED.ends_at,
             capacity = EXCLUDED.capacity, booked = EXCLUDED.booked, early_window = EXCLUDED.early_window
           RETURNING *
         )
         SELECT ${COLUMNS} FROM upserted s LEFT JOIN logistics.routes r ON r.id = s.route_id`,
        [
          slot.id,
          slot.routeId,
          slot.startsAt,
          slot.endsAt,
          slot.capacity,
          slot.booked,
          slot.earlyWindow,
        ],
      ),
    );
    return toSlot(rows[0]);
  }

  async setBooked(id: string, booked: number): Promise<void> {
    await this.db.withSession(currentSession(), (tx) =>
      tx.query(`UPDATE logistics.slots SET booked = $2 WHERE external_id = $1`, [id, booked]),
    );
  }
}
