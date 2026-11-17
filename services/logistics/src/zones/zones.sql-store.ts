import type { Db } from '@ag/db';
import { currentSession, toCents, toCentsOrUndefined } from '@ag/db';
import { GeoPoint, Zone } from './zones.types';
import { ZoneStore } from './zones.store';

interface ZoneRow {
  id: number;
  code: string;
  name: string;
  fee_cents: string | number;
  free_over_cents: string | number | null;
  polygon: GeoPoint[] | null;
}

const COLUMNS = 'id, code, name, fee_cents, free_over_cents, polygon';

function toZone(row: ZoneRow): Zone {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    feeCents: toCents(row.fee_cents),
    ...(toCentsOrUndefined(row.free_over_cents) !== undefined
      ? { freeOverCents: toCentsOrUndefined(row.free_over_cents) }
      : {}),
    ...(row.polygon ? { polygon: row.polygon } : {}),
  };
}

/** SQL adapter over `logistics.zones`. The zone id is the serial integer. */
export class PgZoneStore implements ZoneStore {
  constructor(private readonly db: Db) {}

  async list(): Promise<Zone[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ZoneRow>(`SELECT ${COLUMNS} FROM logistics.zones ORDER BY code`),
    );
    return rows.map(toZone);
  }

  async get(id: number): Promise<Zone | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ZoneRow>(`SELECT ${COLUMNS} FROM logistics.zones WHERE id = $1`, [id]),
    );
    return rows[0] ? toZone(rows[0]) : undefined;
  }

  async insert(zone: Zone): Promise<Zone> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<ZoneRow>(
        `INSERT INTO logistics.zones (code, name, fee_cents, free_over_cents, polygon)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (code) DO UPDATE SET
           name = EXCLUDED.name, fee_cents = EXCLUDED.fee_cents,
           free_over_cents = EXCLUDED.free_over_cents, polygon = EXCLUDED.polygon
         RETURNING ${COLUMNS}`,
        [
          zone.code,
          zone.name,
          zone.feeCents,
          zone.freeOverCents ?? null,
          zone.polygon ? JSON.stringify(zone.polygon) : null,
        ],
      ),
    );
    return toZone(rows[0]);
  }
}
