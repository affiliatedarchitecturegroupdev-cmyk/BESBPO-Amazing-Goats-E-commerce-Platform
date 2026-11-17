import type { Db } from '@ag/db';
import { currentSession } from '@ag/db';
import { Route } from './routes.types';
import { RouteStore } from './routes.store';

interface RouteRow {
  external_id: string;
  name: string;
  day_of_week: number;
  zone_id: number | null;
  vehicle_id: string | null;
  capacity_boxes: number | null;
}

const COLUMNS = 'external_id, name, day_of_week, zone_id, vehicle_id, capacity_boxes';

function toRoute(row: RouteRow): Route {
  return {
    id: row.external_id,
    name: row.name,
    dayOfWeek: row.day_of_week,
    ...(row.zone_id !== null ? { zoneId: row.zone_id } : {}),
    ...(row.vehicle_id !== null ? { vehicleId: row.vehicle_id } : {}),
    ...(row.capacity_boxes !== null ? { capacityBoxes: row.capacity_boxes } : {}),
  };
}

/** SQL adapter over `logistics.routes`; the domain id lives in `external_id`. */
export class PgRouteStore implements RouteStore {
  constructor(private readonly db: Db) {}

  async list(): Promise<Route[]> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RouteRow>(`SELECT ${COLUMNS} FROM logistics.routes ORDER BY day_of_week, name`),
    );
    return rows.map(toRoute);
  }

  async get(id: string): Promise<Route | undefined> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RouteRow>(`SELECT ${COLUMNS} FROM logistics.routes WHERE external_id = $1`, [id]),
    );
    return rows[0] ? toRoute(rows[0]) : undefined;
  }

  async insert(route: Route): Promise<Route> {
    const { rows } = await this.db.withSession(currentSession(), (tx) =>
      tx.query<RouteRow>(
        `INSERT INTO logistics.routes (external_id, name, day_of_week, zone_id, vehicle_id, capacity_boxes)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (external_id) DO UPDATE SET
           name = EXCLUDED.name, day_of_week = EXCLUDED.day_of_week, zone_id = EXCLUDED.zone_id,
           vehicle_id = EXCLUDED.vehicle_id, capacity_boxes = EXCLUDED.capacity_boxes
         RETURNING ${COLUMNS}`,
        [
          route.id,
          route.name,
          route.dayOfWeek,
          route.zoneId ?? null,
          route.vehicleId ?? null,
          route.capacityBoxes ?? null,
        ],
      ),
    );
    return toRoute(rows[0]);
  }
}
