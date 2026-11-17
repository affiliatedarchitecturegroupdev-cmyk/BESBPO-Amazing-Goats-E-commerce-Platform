import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgZoneStore } from './zones/zones.sql-store';
import { PgRouteStore } from './routes/routes.sql-store';
import { PgSlotStore } from './slots/slots.sql-store';
import { PgSyncEventStore } from './driver-sync/driver-sync.sql-store';
import type { DriverEvent } from './driver-sync/driver-sync.types';

/**
 * Integration test for the logistics SQL adapters against a real Postgres. It
 * runs only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped
 * so the default unit run needs no database. Logistics carries no personal data,
 * so its tables have no row-level security; the test still provisions a plain
 * NOSUPERUSER role to prove the adapters work without elevated rights.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_logistics_it';
const PASSWORD = 'ag_logistics_it';

const ZONE_CODE = 'IT-ZONE';
const ROUTE_REF = 'r_it_1';
const SLOT_REF = 's_it_1';
const EVENT_REF = 'e_it_1';

function asRole(url: string, role: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = role;
  parsed.password = password;
  return parsed.toString();
}

let app: PgDb | undefined;
let zoneId = 0;

async function dropRole(): Promise<void> {
  await admin!.query(
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}')
       THEN EXECUTE 'DROP OWNED BY ${ROLE}'; END IF; END $$;`,
  );
  await admin!.query(`DROP ROLE IF EXISTS ${ROLE}`);
}

async function cleanFixtures(): Promise<void> {
  await admin!.query(`DELETE FROM logistics.sync_events WHERE external_id = '${EVENT_REF}'`);
  await admin!.query(`DELETE FROM logistics.slots WHERE external_id = '${SLOT_REF}'`);
  await admin!.query(`DELETE FROM logistics.routes WHERE external_id = '${ROUTE_REF}'`);
  await admin!.query(`DELETE FROM logistics.zones WHERE code = '${ZONE_CODE}'`);
}

describe.skipIf(!admin)('logistics SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA logistics, identity TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA logistics TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA logistics TO ${ROLE}`,
    );
    app = new PgDb(asRole(adminUrl!, ROLE, PASSWORD));
  });

  afterAll(async () => {
    if (!admin) return;
    await app?.end();
    await cleanFixtures();
    await dropRole();
    await admin.end();
  });

  describe('PgZoneStore', () => {
    it('inserts a zone and reads it back by id and code', async () => {
      const store = new PgZoneStore(app!);
      const inserted = await store.insert({
        id: 0,
        code: ZONE_CODE,
        name: 'IT Zone',
        feeCents: 6500,
        freeOverCents: 75000,
        polygon: [
          { lat: -26.1, lng: 28.0 },
          { lat: -26.2, lng: 28.1 },
        ],
      });
      zoneId = inserted.id;
      expect(inserted.feeCents).toBe(6500);
      expect(inserted.freeOverCents).toBe(75000);
      const byId = await store.get(zoneId);
      expect(byId?.code).toBe(ZONE_CODE);
      expect(byId?.polygon).toHaveLength(2);
    });
  });

  describe('PgRouteStore', () => {
    it('round-trips a route keyed by its domain id', async () => {
      const store = new PgRouteStore(app!);
      await store.insert({
        id: ROUTE_REF,
        name: 'IT Route',
        dayOfWeek: 2,
        zoneId,
        capacityBoxes: 40,
      });
      const found = await store.get(ROUTE_REF);
      expect(found?.name).toBe('IT Route');
      expect(found?.zoneId).toBe(zoneId);
      expect(found?.capacityBoxes).toBe(40);
      expect((await store.list()).map((r) => r.id)).toContain(ROUTE_REF);
    });
  });

  describe('PgSlotStore', () => {
    it('round-trips a slot and returns its route domain id', async () => {
      const store = new PgSlotStore(app!);
      await store.insert({
        id: SLOT_REF,
        routeId: ROUTE_REF,
        startsAt: '2026-11-19T06:00:00.000Z',
        endsAt: '2026-11-19T12:00:00.000Z',
        capacity: 20,
        booked: 5,
        earlyWindow: true,
      });
      const found = await store.get(SLOT_REF);
      expect(found?.routeId).toBe(ROUTE_REF);
      expect(found?.capacity).toBe(20);
      expect(found?.earlyWindow).toBe(true);

      await store.setBooked(SLOT_REF, 9);
      expect((await store.get(SLOT_REF))?.booked).toBe(9);
    });
  });

  describe('PgSyncEventStore', () => {
    const event = (over: Partial<DriverEvent> = {}): DriverEvent => ({
      id: EVENT_REF,
      deviceId: 'dev-it',
      type: 'arrived',
      stopId: 'stop-it',
      occurredAt: '2026-11-18T06:00:00.000Z',
      payload: { note: 'on site' },
      ...over,
    });

    it('records an event once and reports it as seen', async () => {
      const store = new PgSyncEventStore(app!);
      expect(await store.seen(EVENT_REF)).toBe(false);
      await store.insert(event());
      expect(await store.seen(EVENT_REF)).toBe(true);
      const listed = await store.list();
      expect(listed.find((e) => e.id === EVENT_REF)?.payload).toEqual({ note: 'on site' });
    });

    it('marks events applied', async () => {
      const store = new PgSyncEventStore(app!);
      await store.markApplied([EVENT_REF]);
      const listed = await store.list();
      expect(listed.find((e) => e.id === EVENT_REF)?.applied).toBe(true);
    });
  });
});
