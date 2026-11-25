import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgCatalogueStore } from './catalog/catalog.sql-store';
import { PgPricingStore } from './pricing/pricing.sql-store';
import { PgCycleStore } from './cycles/cycle.sql-store';
import { PgOrderStore } from './orders/orders.sql-store';
import { PgPromotionStore } from './promotions/promotions.sql-store';
import { PgSubscriptionStore } from './subscriptions/subscriptions.sql-store';
import { PgMerchandisingStore } from './merchandising/merchandising.sql-store';
import { PgComplianceStore } from './compliance/compliance.sql-store';
import { PgSupplierApplicationStore } from './onboarding/onboarding.sql-store';
import type { Promotion } from './promotions/promotions.types';
import type { StandingOrder, Subscription } from './subscriptions/subscriptions.types';
import type { MerchSection } from './merchandising/merchandising.types';
import type { SupplierApplication } from './onboarding/supplier-onboarding';
import { buildOrder } from './orders/order-builder';
import type { CycleRecord } from './cycles/cycle-engine';
import type { CatalogueItem } from './catalog/catalog.types';
import type { PriceList } from './pricing/pricing.types';

/**
 * Integration test for the commerce SQL adapters against a real Postgres. It runs
 * only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped so the
 * default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test provisions
 * its own NOSUPERUSER, NOBYPASSRLS role — the shape db/README.md requires of the
 * application — and connects as it, then proves the order adapters read only the
 * rows the session is allowed to see.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_commerce_it';
const PASSWORD = 'ag_commerce_it';

const ORG_A = 'c0a00000-0000-0000-0000-0000000000a1';
const ORG_B = 'c0b00000-0000-0000-0000-0000000000b2';
const USER_A = 'c0a10000-0000-0000-0000-0000000000a1';
const USER_B = 'c0b10000-0000-0000-0000-0000000000b2';
const CYCLE_CODE = 'chilled_meat:2026-11-15T15:00:00.000Z';
const ORDER_A = 'ord_it_a';
const ORDER_B = 'ord_it_b';
const SKU = 'IT-CM-001';

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
  await admin!.query(`DELETE FROM sales.order_lines WHERE order_id IN
    (SELECT id FROM sales.orders WHERE external_id IN ('${ORDER_A}', '${ORDER_B}'))`);
  await admin!.query(`DELETE FROM sales.orders WHERE external_id IN ('${ORDER_A}', '${ORDER_B}')`);
  await admin!.query(`DELETE FROM sales.pick_lists WHERE cycle_id IN (SELECT id FROM sales.cycles WHERE code = '${CYCLE_CODE}')`);
  await admin!.query(`DELETE FROM sales.cycle_purchase_orders WHERE cycle_id IN (SELECT id FROM sales.cycles WHERE code = '${CYCLE_CODE}')`);
  await admin!.query(`DELETE FROM sales.cycles WHERE code = '${CYCLE_CODE}'`);
  await admin!.query(`DELETE FROM catalog.price_list_items WHERE price_list_id IN
    (SELECT id FROM catalog.price_lists WHERE external_id LIKE 'it_pl_%')`);
  await admin!.query(`DELETE FROM catalog.price_lists WHERE external_id LIKE 'it_pl_%'`);
  // Section codes are scoped to this spec's own `it-public`/`it-home-hero`.
  // A broad `it-%` would delete the merchandising spec's `it-live`/`it-draft`
  // rows, whose `catalog.merch_items` then fail that spec's cleanup on a
  // foreign key that is nothing to do with commerce.
  await admin!.query(`DELETE FROM catalog.merch_items WHERE section_id IN
    (SELECT id FROM catalog.merch_sections WHERE code IN ('it-public', 'it-home-hero'))`);
  await admin!.query(`DELETE FROM catalog.merch_sections WHERE code IN ('it-public', 'it-home-hero')`);
  await admin!.query(`DELETE FROM catalog.product_compliance WHERE variant_id IN
    (SELECT id FROM catalog.variants WHERE sku LIKE 'IT-CM-%')`);
  await admin!.query(`DELETE FROM sales.promotions WHERE external_id LIKE 'it_%'`);
  await admin!.query(`DELETE FROM sales.subscriptions WHERE external_id LIKE 'it_%'`);
  await admin!.query(`DELETE FROM sales.standing_orders WHERE external_id LIKE 'it_%'`);
  await admin!.query(`DELETE FROM partners.supplier_applications WHERE org_name LIKE 'IT %'`);
  // Prefix `IT-CM-%`, not `IT-%`: the merchandising spec seeds `IT-MCH-%`
  // variants, and a shared database means a broad delete here removes its rows
  // while `catalog.merch_items` still references them, so that spec's cleanup
  // then fails on a foreign key that is nothing to do with commerce.
  await admin!.query(`DELETE FROM catalog.variants WHERE sku LIKE 'IT-CM-%' OR sku = 'IT-NEW-001'`);
  await admin!.query(`DELETE FROM catalog.products WHERE slug IN ('it-chilled', 'it-new')`);
  await admin!.query(`DELETE FROM catalog.product_lines WHERE code = 'ITC'`);
  await admin!.query(`DELETE FROM identity.users WHERE id IN ('${USER_A}', '${USER_B}')`);
  await admin!.query(`DELETE FROM identity.orgs WHERE id IN ('${ORG_A}', '${ORG_B}')`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO identity.orgs (id, kind, name) VALUES ('${ORG_A}', 'customer', 'IT Org A'), ('${ORG_B}', 'customer', 'IT Org B')`,
  );
  await admin!.query(
    `INSERT INTO identity.users (id, idp_subject, email) VALUES
       ('${USER_A}', 'it-com-a', 'com-a@example.co.za'), ('${USER_B}', 'it-com-b', 'com-b@example.co.za')`,
  );
  await admin!.query(
    `INSERT INTO catalog.product_lines (code, name, grp, phase) VALUES ('ITC', 'IT chilled', 'meat', 1)`,
  );
  await admin!.query(
    `INSERT INTO catalog.products (line_id, slug, name) VALUES
       ((SELECT id FROM catalog.product_lines WHERE code = 'ITC'), 'it-chilled', 'IT chilled product')`,
  );
  await admin!.query(
    `INSERT INTO catalog.variants (product_id, sku, pack, unit, fulfilment, temperature, channel, phase, source_kind)
     VALUES ((SELECT id FROM catalog.products WHERE slug = 'it-chilled'), '${SKU}', '1 kg', 'kg', 'pre_order_cycle', 'chilled', 'both', 1, 'test')`,
  );
}

const catalogueItem = (over: Partial<CatalogueItem> = {}): CatalogueItem => ({
  id: 'IT-NEW-001',
  sku: 'IT-NEW-001',
  productId: 'it-new',
  name: 'IT new product',
  pack: '500 g',
  unit: 'each',
  fulfilment: 'in_stock',
  temperature: 'ambient',
  channel: 'both',
  phase: 1,
  lineCode: 'ITC',
  lineName: 'IT chilled',
  categorySlug: null,
  halaalAvailable: true,
  active: true,
  ...over,
});

const cycle = (): CycleRecord => ({
  id: CYCLE_CODE,
  productClass: 'chilled_meat',
  cutoffAt: '2026-11-15T15:00:00.000Z',
  tradeLockAt: '2026-11-15T10:00:00.000Z',
  topUpUntil: '2026-11-16T10:00:00.000Z',
  slaughterOn: '2026-11-16T04:00:00.000Z',
  deliveryFrom: '2026-11-18T04:00:00.000Z',
  deliveryTo: '2026-11-20T16:00:00.000Z',
  status: 'open',
});

const priceList = (over: Partial<PriceList> = {}): PriceList => ({
  id: 'it_pl_public',
  code: 'it-public',
  name: 'IT public list',
  audience: 'public',
  validFrom: '2026-01-01T00:00:00.000Z',
  validTo: null,
  status: 'draft',
  items: [{ sku: SKU, priceExVatCents: 27500, unitPriceBasis: 'kg' }],
  ...over,
});

describe.skipIf(!admin)('commerce SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA identity, catalog, sales, partners TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity, catalog, sales, partners TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity, catalog, sales, partners TO ${ROLE}`,
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

  describe('PgCatalogueStore', () => {
    it('reads a variant joined with its product and line', async () => {
      const store = new PgCatalogueStore(app!);
      const item = await store.get(SKU);
      expect(item).toMatchObject({
        sku: SKU,
        productId: 'it-chilled',
        lineCode: 'ITC',
        temperature: 'chilled',
        fulfilment: 'pre_order_cycle',
      });
      expect((await store.all()).some((i) => i.sku === SKU)).toBe(true);
    });

    it('upserts a new variant and removes it', async () => {
      const store = new PgCatalogueStore(app!);
      await store.upsert(catalogueItem());
      const read = await store.get('IT-NEW-001');
      expect(read).toMatchObject({ name: 'IT new product', temperature: 'ambient', halaalAvailable: true });

      expect(await store.remove('IT-NEW-001')).toBe(true);
      expect(await store.get('IT-NEW-001')).toBeUndefined();
    });
  });

  describe('PgPricingStore', () => {
    it('inserts a draft list with its items and reads it back', async () => {
      const store = new PgPricingStore(app!);
      await store.insert(priceList());
      const read = await store.get('it_pl_public');
      expect(read?.status).toBe('draft');
      expect(read?.items).toEqual([{ sku: SKU, priceExVatCents: 27500, unitPriceBasis: 'kg' }]);
    });

    it('publishes a list by replacing it, keeping one row per domain id', async () => {
      const store = new PgPricingStore(app!);
      await store.replace(
        priceList({ status: 'published', approvedBy: USER_A, publishedAt: '2026-02-01T00:00:00.000Z' }),
      );
      const all = await store.all();
      expect(all.filter((l) => l.id === 'it_pl_public')).toHaveLength(1);
      expect((await store.get('it_pl_public'))?.status).toBe('published');
    });
  });

  describe('PgCycleStore', () => {
    it('inserts and lists a cycle, and reads its orders', async () => {
      const store = new PgCycleStore(app!);
      await store.insert(cycle());
      expect((await store.get(CYCLE_CODE))?.status).toBe('open');

      // An order assigned to the cycle is visible through the join.
      const orders = new PgOrderStore(app!);
      const cart = {
        lines: [{ sku: SKU, qty: 2, unitPriceExVatCents: 10000, fulfilment: 'pre_order_cycle' as const, temperature: 'chilled' as const }],
      };
      const order = buildOrder(cart, { id: ORDER_A, placedAt: new Date('2026-11-11T10:00:00Z'), cycles: [cycle()] });
      await runWithSession({ orgId: ORG_A, userId: USER_A }, () => orders.insert(order));

      const cycleOrders = await runWithSession({ staff: true }, () => store.orders(CYCLE_CODE));
      expect(cycleOrders).toEqual([{ id: ORDER_A, lines: [{ sku: SKU, qty: 2 }] }]);
    });

    it('stores a pick list and purchase orders', async () => {
      const store = new PgCycleStore(app!);
      await store.savePickList({ cycleId: CYCLE_CODE, lines: [{ sku: SKU, qty: 2 }], totalUnits: 2 });
      await store.savePurchaseOrders([
        { cycleId: CYCLE_CODE, kind: 'abattoir', status: 'draft', lines: [{ sku: SKU, qty: 2 }] },
      ]);
      const { rows } = await admin!.query<{ count: string }>(
        `SELECT count(*)::text AS count FROM sales.pick_lists WHERE cycle_id = (SELECT id FROM sales.cycles WHERE code = '${CYCLE_CODE}')`,
      );
      expect(rows[0].count).toBe('1');
    });
  });

  describe('PgOrderStore', () => {
    it('scopes an order to its owning org and hides it from another', async () => {
      const store = new PgOrderStore(app!);
      const cart = {
        lines: [{ sku: SKU, qty: 3, unitPriceExVatCents: 20000, fulfilment: 'in_stock' as const, temperature: 'chilled' as const }],
        deliveryFeeCents: 5000,
      };
      const order = buildOrder(cart, { id: ORDER_B, placedAt: new Date('2026-11-12T10:00:00Z') });
      await runWithSession({ orgId: ORG_B, userId: USER_B }, () => store.insert(order));

      const orgB = await runWithSession({ orgId: ORG_B }, () => store.get(ORDER_B));
      expect(orgB?.lines).toEqual([
        { sku: SKU, qty: 3, unitPriceExVatCents: 20000, fulfilment: 'in_stock', temperature: 'chilled' },
      ]);
      expect(orgB?.deliveryFeeCents).toBe(5000);

      const orgA = await runWithSession({ orgId: ORG_A }, () => store.get(ORDER_B));
      expect(orgA).toBeUndefined();
    });

    it('moves an order status under a staff session', async () => {
      const store = new PgOrderStore(app!);
      await runWithSession({ staff: true }, () => store.updateStatus(ORDER_B, 'confirmed'));
      expect((await runWithSession({ staff: true }, () => store.get(ORDER_B)))?.status).toBe('confirmed');
    });
  });

  describe('PgPromotionStore', () => {
    const draft: Promotion = {
      id: 'it_pr_spring',
      code: 'ITSPRING5',
      name: 'IT spring 5%',
      kind: 'percent',
      percent: 5,
      startsAt: '2026-01-01T00:00:00.000Z',
      endsAt: null,
      status: 'draft',
      stackable: false,
    };

    it('round-trips a promotion and hides a draft from a non-staff session', async () => {
      const store = new PgPromotionStore(app!);
      await runWithSession({ staff: true }, () => store.insert(draft));
      const read = await runWithSession({ staff: true }, () => store.get(draft.id));
      expect(read).toMatchObject({ code: 'ITSPRING5', kind: 'percent', percent: 5, status: 'draft' });

      // A draft is not public: a customer session must not see it.
      const asCustomer = await runWithSession({ orgId: ORG_A }, () => store.get(draft.id));
      expect(asCustomer).toBeUndefined();
    });

    it('makes an approved promotion visible to a customer', async () => {
      const store = new PgPromotionStore(app!);
      await runWithSession({ staff: true }, () =>
        store.replace({ ...draft, status: 'approved', approvedBy: USER_A }),
      );
      const asCustomer = await runWithSession({ orgId: ORG_A }, () => store.get(draft.id));
      expect(asCustomer?.status).toBe('approved');
    });
  });

  describe('PgSubscriptionStore', () => {
    const subscription: Subscription = {
      id: 'it_sub_1',
      customerUserId: USER_A,
      bundleId: 'bundle_braai',
      cadence: 'fortnightly',
      nextRunAt: '2026-12-01T06:00:00.000Z',
      paused: false,
      skipped: ['2026-11-17T06:00:00.000Z'],
    };

    it('round-trips a subscription and scopes it to its customer', async () => {
      const store = new PgSubscriptionStore(app!);
      await runWithSession({ userId: USER_A }, () => store.saveSubscription(subscription));
      const mine = await runWithSession({ userId: USER_A }, () => store.getSubscription(subscription.id));
      expect(mine).toMatchObject({ cadence: 'fortnightly', customerUserId: USER_A, bundleId: 'bundle_braai' });
      expect(mine?.skipped).toEqual(['2026-11-17T06:00:00.000Z']);

      const theirs = await runWithSession({ userId: USER_B }, () => store.getSubscription(subscription.id));
      expect(theirs).toBeUndefined();
    });

    it('round-trips a standing order with its lines', async () => {
      const store = new PgSubscriptionStore(app!);
      const standing: StandingOrder = {
        id: 'it_so_1',
        orgId: ORG_A,
        dayOfWeek: 2,
        deliveryWindow: '06:00-10:00',
        pausedUntil: null,
        active: true,
        lines: [{ variantId: 'var_1', qty: 10 }],
      };
      await runWithSession({ orgId: ORG_A }, () => store.saveStandingOrder(standing));
      const read = await runWithSession({ orgId: ORG_A }, () => store.getStandingOrder(standing.id));
      expect(read).toMatchObject({ dayOfWeek: 2, deliveryWindow: '06:00-10:00', active: true });
      expect(read?.lines).toEqual([{ variantId: 'var_1', qty: 10 }]);
    });
  });

  describe('PgMerchandisingStore', () => {
    const section: MerchSection = {
      id: 'it_sec_1',
      code: 'it-home-hero',
      title: 'IT home hero',
      page: 'home',
      sort: 1,
      active: true,
      startsAt: null,
      endsAt: null,
    };

    it('round-trips a section and its items against the catalogue', async () => {
      const store = new PgMerchandisingStore(app!);
      await store.saveSection(section);
      await store.replaceItems(section.id, [{ sectionId: 'ignored', sku: SKU, sort: 3, badge: 'it-badge' }]);

      expect((await store.getSection(section.id))?.title).toBe('IT home hero');
      const items = await store.itemsForSection(section.id);
      expect(items).toEqual([{ sectionId: section.id, sku: SKU, sort: 3, badge: 'it-badge' }]);

      // Replacing wholesale leaves exactly the new set.
      await store.replaceItems(section.id, []);
      expect(await store.itemsForSection(section.id)).toEqual([]);
    });
  });

  describe('PgComplianceStore', () => {
    it('upserts a compliance row keyed by sku', async () => {
      const store = new PgComplianceStore(app!);
      await store.upsert({ variantSku: SKU, ruleSet: 'meat_abattoir', classOrGrade: 'A2' });
      expect(await store.get(SKU)).toMatchObject({ ruleSet: 'meat_abattoir', classOrGrade: 'A2' });

      await store.upsert({ variantSku: SKU, ruleSet: 'meat_abattoir', classOrGrade: 'A3' });
      expect((await store.get(SKU))?.classOrGrade).toBe('A3');
      expect((await store.all()).filter((c) => (c as { variantSku?: string }).variantSku === SKU)).toHaveLength(1);
    });
  });

  describe('PgSupplierApplicationStore', () => {
    it('round-trips an application and is staff-only', async () => {
      const store = new PgSupplierApplicationStore(app!);
      const application: SupplierApplication = {
        orgName: 'IT Dairy Co',
        kind: 'dairy',
        documents: [{ kind: 'dairy_approval', reference: 'DA-1', verified: true, expiresOn: '2027-01-01' }],
      };
      await runWithSession({ staff: true }, () => store.upsert(application));
      const read = await runWithSession({ staff: true }, () => store.all());
      expect(read.find((a) => a.orgName === 'IT Dairy Co')?.documents).toEqual(application.documents);

      // Onboarding is a staff workflow: a customer session sees nothing.
      const asCustomer = await runWithSession({ orgId: ORG_A }, () => store.all());
      expect(asCustomer).toEqual([]);
    });
  });
});
