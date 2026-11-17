import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgPartnerStore } from './partner.sql-store';

/**
 * Integration test for the partners SQL adapter against a real Postgres. It runs
 * only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped so
 * the default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test
 * provisions its own NOSUPERUSER, NOBYPASSRLS role — the shape db/README.md
 * requires of the application — and connects as it, then proves a partner sees
 * only their own organisation's slots, purchase orders and documents.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_partners_it';
const PASSWORD = 'ag_partners_it';

const ORG_A = 'ba000000-0000-0000-0000-0000000000a1';
const ORG_B = 'ba000000-0000-0000-0000-0000000000b2';
const ORG_REF_A = 'org_partners_it_a';
const ORG_REF_B = 'org_partners_it_b';

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
  await admin!.query(`DELETE FROM partners.slots WHERE external_id LIKE 'slot_it_%'`);
  await admin!.query(`DELETE FROM partners.purchase_orders WHERE external_id LIKE 'po_it_%'`);
  await admin!.query(`DELETE FROM partners.documents WHERE external_id LIKE 'doc_it_%'`);
  await admin!.query(`DELETE FROM identity.orgs WHERE id IN ('${ORG_A}', '${ORG_B}')`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO identity.orgs (id, kind, name, external_id)
       VALUES ('${ORG_A}', 'abattoir', 'IT Abattoir A', '${ORG_REF_A}'),
              ('${ORG_B}', 'partner_farm', 'IT Farm B', '${ORG_REF_B}')`,
  );
}

describe.skipIf(!admin)('partners SQL adapter (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA partners, identity TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA partners, identity TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA partners, identity TO ${ROLE}`,
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

  describe('PgPartnerStore', () => {
    it('round-trips a slaughter slot and reads it by organisation', async () => {
      const store = new PgPartnerStore(app!);
      await runWithSession({ staff: true }, () =>
        store.saveSlot({
          id: 'slot_it_mon',
          orgId: ORG_REF_A,
          date: 'Mon',
          capacity: 120,
          booked: 98,
          confirmed: false,
          halaal: true,
        }),
      );
      const slots = await runWithSession({ staff: true }, () => store.slots(ORG_REF_A));
      const found = slots.find((s) => s.id === 'slot_it_mon');
      expect(found?.capacity).toBe(120);
      expect(found?.date).toBe('Mon');
      expect(found?.halaal).toBe(true);

      await runWithSession({ staff: true }, () =>
        store.saveSlot({ ...found!, confirmed: true }),
      );
      const confirmed = (await runWithSession({ staff: true }, () => store.slots(ORG_REF_A))).find(
        (s) => s.id === 'slot_it_mon',
      );
      expect(confirmed?.confirmed).toBe(true);
    });

    it('scopes slots to the owning organisation and denies another', async () => {
      const store = new PgPartnerStore(app!);
      const own = await runWithSession({ orgId: ORG_REF_A }, () => store.slots(ORG_REF_A));
      expect(own.map((s) => s.id)).toContain('slot_it_mon');
      const other = await runWithSession({ orgId: ORG_REF_B }, () => store.slots(ORG_REF_A));
      expect(other).toEqual([]);
    });

    it('reads purchase orders scoped to the organisation', async () => {
      const store = new PgPartnerStore(app!);
      await admin!.query(
        `INSERT INTO partners.purchase_orders
           (external_id, partner_org_id, partner_org_ref, code, description, day_label, status)
         VALUES ('po_it_118', '${ORG_A}', '${ORG_REF_A}', 'PO-118', '200 broilers', 'Wed', 'sent')`,
      );
      const orders = await runWithSession({ orgId: ORG_REF_A }, () => store.purchaseOrders(ORG_REF_A));
      expect(orders.map((o) => o.code)).toEqual(['PO-118']);
      expect(orders[0].status).toBe('sent');

      const otherOrg = await runWithSession({ orgId: ORG_REF_B }, () =>
        store.purchaseOrders(ORG_REF_A),
      );
      expect(otherOrg).toEqual([]);
    });

    it('reads documents scoped to the organisation', async () => {
      const store = new PgPartnerStore(app!);
      await admin!.query(
        `INSERT INTO partners.documents (external_id, partner_org_id, partner_org_ref, name, expires_on)
         VALUES ('doc_it_halaal', '${ORG_A}', '${ORG_REF_A}', 'Halaal certificate', '2027-01-12')`,
      );
      const docs = await runWithSession({ orgId: ORG_REF_A }, () => store.documents(ORG_REF_A));
      expect(docs.map((d) => d.name)).toEqual(['Halaal certificate']);
      expect(docs[0].expiresOn).toBe('2027-01-12');

      const otherOrg = await runWithSession({ orgId: ORG_REF_B }, () => store.documents(ORG_REF_A));
      expect(otherOrg).toEqual([]);
    });

    it('hides everything from a default-deny session', async () => {
      const store = new PgPartnerStore(app!);
      expect(await store.slots(ORG_REF_A)).toEqual([]);
      expect(await store.purchaseOrders(ORG_REF_A)).toEqual([]);
      expect(await store.documents(ORG_REF_A)).toEqual([]);
    });
  });
});
