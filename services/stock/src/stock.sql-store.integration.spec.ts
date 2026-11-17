import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgBatchStore } from './batches/batches.sql-store';
import { PgRecallStore } from './recalls/recalls.sql-store';
import { PgTemperatureStore } from './temperature/temperature.sql-store';
import { PgMovementSource, PgOrderSource } from './traceability/traceability.sql-store';
import { traceBatch } from './traceability/traceability.domain';
import type { Batch } from './batches/batches.types';

/**
 * Integration test for the stock SQL adapters against a real Postgres. It runs
 * only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped so the
 * default unit run needs no database.
 *
 * `inventory` carries no row-level security, but `sales.order_lines` (read by the
 * order source) is governed by the order it belongs to, so the test seeds an
 * order and reads through a staff session.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_stock_it';
const PASSWORD = 'ag_stock_it';

const ORG_A = '57000000-0000-0000-0000-0000000000a1';
const USER_A = '57010000-0000-0000-0000-0000000000a1';
const PRODUCT_A = '57020000-0000-0000-0000-0000000000a1';
const VARIANT_A = '57030000-0000-0000-0000-0000000000a1';
const ORDER_A = '57040000-0000-0000-0000-0000000000a1';
const LINE_A = '57050000-0000-0000-0000-0000000000a1';
const BATCH_REF = 'batch_it_1';
const RECALL_REF = 'rec_it_1';

function asRole(url: string, role: string, password: string): string {
  const parsed = new URL(url);
  parsed.username = role;
  parsed.password = password;
  return parsed.toString();
}

let app: PgDb | undefined;

async function dropRole(): Promise<void> {
  await admin!.query(
    `DO $$ BEGIN IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${ROLE}')
       THEN EXECUTE 'DROP OWNED BY ${ROLE}'; END IF; END $$;`,
  );
  await admin!.query(`DROP ROLE IF EXISTS ${ROLE}`);
}

async function cleanFixtures(): Promise<void> {
  await admin!.query(
    `DELETE FROM inventory.stock_movements WHERE batch_id IN (SELECT id FROM inventory.batches WHERE external_id = '${BATCH_REF}')`,
  );
  await admin!.query(`DELETE FROM inventory.recalls WHERE external_id = '${RECALL_REF}'`);
  await admin!.query(`DELETE FROM inventory.temperature_logs WHERE subject_ref LIKE 'batch_it_%'`);
  await admin!.query(`DELETE FROM sales.order_lines WHERE id = '${LINE_A}'`);
  await admin!.query(`DELETE FROM sales.orders WHERE id = '${ORDER_A}'`);
  await admin!.query(`DELETE FROM inventory.batches WHERE external_id = '${BATCH_REF}'`);
  await admin!.query(`DELETE FROM catalog.variants WHERE id = '${VARIANT_A}'`);
  await admin!.query(`DELETE FROM catalog.products WHERE id = '${PRODUCT_A}'`);
  await admin!.query(`DELETE FROM identity.users WHERE id = '${USER_A}'`);
  await admin!.query(`DELETE FROM identity.orgs WHERE id = '${ORG_A}'`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO identity.orgs (id, kind, name) VALUES ('${ORG_A}', 'customer', 'IT Stock Org')`,
  );
  await admin!.query(
    `INSERT INTO identity.users (id, idp_subject, email) VALUES ('${USER_A}', 'it-stock-a', 'stock-a@example.co.za')`,
  );
  await admin!.query(
    `INSERT INTO catalog.products (id, line_id, slug, name) VALUES ('${PRODUCT_A}', 2, 'it-stock-product', 'IT Stock Product')`,
  );
  await admin!.query(
    `INSERT INTO catalog.variants (id, product_id, sku, unit, fulfilment, temperature, channel, phase, source_kind)
       VALUES ('${VARIANT_A}', '${PRODUCT_A}', 'IT-STOCK-SKU', 'pack', 'in_stock', 'chilled', 'both', 2, 'Co-packer')`,
  );
  await admin!.query(
    `INSERT INTO sales.orders (id, org_id, customer_user_id, status)
       VALUES ('${ORDER_A}', '${ORG_A}', '${USER_A}', 'confirmed')`,
  );
}

describe.skipIf(!admin)('stock SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA inventory, catalog, sales, identity TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA inventory, catalog, sales, identity TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA inventory, catalog, sales, identity TO ${ROLE}`,
    );
    await seedFixtures();
    app = new PgDb(asRole(adminUrl!, ROLE, PASSWORD));
  });

  afterAll(async () => {
    if (!admin) return;
    await app?.end();
    await cleanFixtures();
    await dropRole();
    await admin.end();
  });

  describe('PgBatchStore', () => {
    const batch = (over: Partial<Batch> = {}): Batch => ({
      id: BATCH_REF,
      batchCode: 'AG-IT-0001',
      sku: 'IT-STOCK-SKU',
      pack: '1kg',
      packedOn: '2026-11-10',
      useBy: '2026-11-20',
      grossWeightG: 1000,
      grade: 'A',
      halaalCertified: true,
      temperatureStatus: 'ok',
      status: 'quarantine',
      ...over,
    });

    it('inserts a batch resolving its SKU to a variant, and reads it back', async () => {
      const store = new PgBatchStore(app!);
      const [saved] = await runWithSession({ staff: true }, () => store.insertMany([batch()]));
      expect(saved.sku).toBe('IT-STOCK-SKU');
      expect(saved.pack).toBe('1kg');
      expect(saved.grossWeightG).toBe(1000);
      expect(saved.halaalCertified).toBe(true);

      const found = await runWithSession({ staff: true }, () => store.get(BATCH_REF));
      expect(found?.batchCode).toBe('AG-IT-0001');
      expect(found?.packedOn).toBe('2026-11-10');
      expect(found?.useBy).toBe('2026-11-20');
    });

    it('changes a batch status', async () => {
      const store = new PgBatchStore(app!);
      await runWithSession({ staff: true }, () => store.setStatus(BATCH_REF, 'released'));
      expect((await runWithSession({ staff: true }, () => store.get(BATCH_REF)))?.status).toBe(
        'released',
      );
    });
  });

  describe('PgRecallStore', () => {
    it('opens a recall and reads it back with its affected orders', async () => {
      const store = new PgRecallStore(app!);
      await runWithSession({ staff: true }, () =>
        store.insert({
          id: RECALL_REF,
          batchId: BATCH_REF,
          reason: 'temperature breach',
          openedBy: 'ops_it',
          openedAt: '2026-11-11T00:00:00.000Z',
          affectedOrderIds: [ORDER_A],
        }),
      );
      const found = await runWithSession({ staff: true }, () => store.get(RECALL_REF));
      expect(found?.batchId).toBe(BATCH_REF);
      expect(found?.affectedOrderIds).toEqual([ORDER_A]);
      await runWithSession({ staff: true }, () =>
        store.close(RECALL_REF, '2026-11-12T00:00:00.000Z'),
      );
      expect((await runWithSession({ staff: true }, () => store.get(RECALL_REF)))?.closedAt).toBe(
        '2026-11-12T00:00:00.000Z',
      );
    });
  });

  describe('PgTemperatureStore', () => {
    it('records readings and filters by subject', async () => {
      const store = new PgTemperatureStore(app!);
      await store.insertMany([
        {
          id: 'tlog_it_1',
          subjectType: 'batch',
          subjectId: BATCH_REF,
          celsius: 3.5,
          at: '2026-11-11T06:00:00.000Z',
          source: 'probe',
        },
        {
          id: 'tlog_it_2',
          subjectType: 'batch',
          subjectId: BATCH_REF,
          celsius: 9.1,
          at: '2026-11-11T07:00:00.000Z',
          source: 'probe',
        },
      ]);
      const all = await store.list({ subjectType: 'batch', subjectId: BATCH_REF });
      expect(all.map((r) => r.celsius)).toEqual([3.5, 9.1]);
      expect(all[0].id).toBe('tlog_it_1');
    });
  });

  describe('PgMovementSource / PgOrderSource', () => {
    it('joins order lines to their batch and SKU for traceability', async () => {
      await admin!.query(
        `INSERT INTO sales.order_lines (id, order_id, variant_id, qty, unit_price_ex_vat_cents, fulfilment, batch_id)
           VALUES ('${LINE_A}', '${ORDER_A}', '${VARIANT_A}', 1, 10000, 'in_stock',
                   (SELECT id FROM inventory.batches WHERE external_id = '${BATCH_REF}'))`,
      );
      await admin!.query(
        `INSERT INTO inventory.stock_movements (batch_id, kind, qty, ref_type, ref_id, at)
           VALUES ((SELECT id FROM inventory.batches WHERE external_id = '${BATCH_REF}'), 'in', 10, 'intake', 'IT-1', '2026-11-10T00:00:00.000Z')`,
      );

      const movements = await runWithSession({ staff: true }, () =>
        new PgMovementSource(app!).list(),
      );
      expect(movements.find((m) => m.batchId === BATCH_REF)?.qty).toBe(10);

      const orders = await runWithSession({ staff: true }, () => new PgOrderSource(app!).list());
      const order = orders.find((o) => o.id === ORDER_A);
      expect(order?.lines).toEqual([{ sku: 'IT-STOCK-SKU', batchId: BATCH_REF }]);

      const batch = await runWithSession({ staff: true }, () =>
        new PgBatchStore(app!).get(BATCH_REF),
      );
      const trace = traceBatch(batch!, movements, orders);
      expect(trace.orderCount).toBe(1);
      expect(trace.movements).toHaveLength(1);
    });
  });
});
