import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgMerchandisingStore } from './merchandising.sql-store';
import { MerchItem, MerchSection } from './merchandising.types';

/**
 * Integration test for the merchandising SQL adapter against a real Postgres. It
 * runs only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped
 * so the default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test provisions
 * its own NOSUPERUSER, NOBYPASSRLS role — the shape db/README.md requires of the
 * application — and connects as it. It then proves the two promises migration
 * 0018 makes: staff manage every section, and a public read (no staff setting)
 * sees only an active, in-window section.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_merch_it';
const PASSWORD = 'ag_merch_it';

const LINE = 'MCHIT';
const SKU_A = 'IT-MCH-001';
const SKU_B = 'IT-MCH-002';
const SECTION_LIVE = 'sec_it_live';
const SECTION_DRAFT = 'sec_it_draft';
const SECTION_EXPIRED = 'sec_it_expired';

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
    `DELETE FROM catalog.merch_items WHERE section_id IN
       (SELECT id FROM catalog.merch_sections WHERE external_id LIKE 'sec_it_%')`,
  );
  await admin!.query(`DELETE FROM catalog.merch_sections WHERE external_id LIKE 'sec_it_%'`);
  await admin!.query(`DELETE FROM catalog.variants WHERE sku LIKE 'IT-MCH-%'`);
  await admin!.query(`DELETE FROM catalog.products WHERE slug LIKE 'it-mch%'`);
  await admin!.query(`DELETE FROM catalog.product_lines WHERE code = '${LINE}'`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(`INSERT INTO catalog.product_lines (code, name, grp, phase) VALUES ('${LINE}', 'IT merch', 'test', 1)`);
  await admin!.query(
    `INSERT INTO catalog.products (line_id, slug, name) VALUES
       ((SELECT id FROM catalog.product_lines WHERE code = '${LINE}'), 'it-mch', 'IT merch product')`,
  );
  for (const sku of [SKU_A, SKU_B]) {
    await admin!.query(
      `INSERT INTO catalog.variants (product_id, sku, pack, unit, fulfilment, temperature, channel, phase, source_kind)
       VALUES ((SELECT id FROM catalog.products WHERE slug = 'it-mch'), $1, '1 kg', 'kg', 'in_stock', 'ambient', 'both', 1, 'test')`,
      [sku],
    );
  }
}

const section = (over: Partial<MerchSection> = {}): MerchSection => ({
  id: SECTION_LIVE,
  code: 'it-live',
  title: 'IT live strip',
  page: 'home',
  sort: 0,
  active: true,
  startsAt: null,
  endsAt: null,
  ...over,
});

const item = (over: Partial<MerchItem> = {}): MerchItem => ({
  sectionId: SECTION_LIVE,
  sku: SKU_A,
  sort: 0,
  badge: null,
  ...over,
});

describe.skipIf(!admin)('merchandising SQL adapter (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA catalog TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalog TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA catalog TO ${ROLE}`,
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

  it('round-trips a section and its items under a staff session', async () => {
    const store = new PgMerchandisingStore(app!);
    await runWithSession({ staff: true }, () =>
      store.saveSection(section({ id: SECTION_LIVE, code: 'it-live', title: 'IT live strip' })),
    );
    const read = await runWithSession({ staff: true }, () => store.getSection(SECTION_LIVE));
    expect(read).toMatchObject({ id: SECTION_LIVE, code: 'it-live', page: 'home', active: true });
    expect(read?.startsAt).toBeNull();

    await runWithSession({ staff: true }, () =>
      store.replaceItems(SECTION_LIVE, [
        item({ sku: SKU_B, sort: 1, badge: 'special' }),
        item({ sku: SKU_A, sort: 0 }),
      ]),
    );
    const items = await runWithSession({ staff: true }, () => store.itemsForSection(SECTION_LIVE));
    expect(items).toEqual([
      { sectionId: SECTION_LIVE, sku: SKU_A, sort: 0, badge: null },
      { sectionId: SECTION_LIVE, sku: SKU_B, sort: 1, badge: 'special' },
    ]);
  });

  it('reorders a section by re-saving its sort', async () => {
    const store = new PgMerchandisingStore(app!);
    await runWithSession({ staff: true }, () => store.saveSection(section({ sort: 5 })));
    expect((await runWithSession({ staff: true }, () => store.getSection(SECTION_LIVE)))?.sort).toBe(5);
  });

  it('shows a live section to an anonymous (public) read but hides a draft and an expired one', async () => {
    const store = new PgMerchandisingStore(app!);
    await runWithSession({ staff: true }, async () => {
      await store.saveSection(section({ id: SECTION_LIVE, code: 'it-live', active: true }));
      await store.saveSection(
        section({ id: SECTION_DRAFT, code: 'it-draft', active: false }),
      );
      await store.saveSection(
        section({
          id: SECTION_EXPIRED,
          code: 'it-expired',
          active: true,
          startsAt: '2000-01-01T00:00:00.000Z',
          endsAt: '2000-02-01T00:00:00.000Z',
        }),
      );
    });

    // No app.staff: the public policy applies.
    const visible = await store.sections();
    expect(visible.map((s) => s.id)).toEqual([SECTION_LIVE]);

    // Staff still see all three.
    const all = await runWithSession({ staff: true }, () => store.sections());
    expect(all.map((s) => s.id).sort()).toEqual([SECTION_DRAFT, SECTION_EXPIRED, SECTION_LIVE].sort());
  });

  it('refuses a write from a non-staff session', async () => {
    const store = new PgMerchandisingStore(app!);
    await expect(store.saveSection(section({ id: 'sec_it_denied', code: 'it-denied' }))).rejects.toThrow();
  });
});
