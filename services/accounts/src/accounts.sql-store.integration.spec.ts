import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgCreditLimitsStore } from './credit-limits/credit-limits.sql-store';
import { PgInvoicesStore } from './invoices/invoices.sql-store';
import { PgCollectionsStore } from './collections/collections.sql-store';
import { buildStatement } from './statements/statement.rules';
import type { CreditProposal } from './credit-limits/credit-approval.rules';

/**
 * Integration test for the accounts SQL adapters against a real Postgres. It runs
 * only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped so the
 * default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so the test provisions
 * its own NOSUPERUSER, NOBYPASSRLS role — the shape db/README.md requires of the
 * application — and connects as it, then proves the adapters read only the rows
 * the session is allowed to see.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_accounts_it';
const PASSWORD = 'ag_accounts_it';

const ORG_A = 'a0a00000-0000-0000-0000-0000000000a1';
const ORG_B = 'a0b00000-0000-0000-0000-0000000000b2';
const USER_A = 'a0a10000-0000-0000-0000-0000000000a1';
const USER_B = 'a0b10000-0000-0000-0000-0000000000b2';
const INVOICE_A = 'a0a30000-0000-0000-0000-0000000000a1';
const INVOICE_B = 'a0b30000-0000-0000-0000-0000000000b2';
const LINE_A = 'a0a40000-0000-0000-0000-0000000000a1';
const ACTION_A = 'a0a50000-0000-0000-0000-0000000000a1';
const LIMIT_A = 'a0a60000-0000-0000-0000-0000000000a1';

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
  await admin!.query(`DELETE FROM accounts.collection_actions WHERE id = '${ACTION_A}'`);
  await admin!.query(`DELETE FROM accounts.invoice_lines WHERE invoice_id IN ('${INVOICE_A}', '${INVOICE_B}')`);
  await admin!.query(`DELETE FROM accounts.invoices WHERE id IN ('${INVOICE_A}', '${INVOICE_B}')`);
  await admin!.query(`DELETE FROM accounts.credit_limits WHERE org_id IN ('${ORG_A}', '${ORG_B}')`);
  await admin!.query(`DELETE FROM identity.users WHERE id IN ('${USER_A}', '${USER_B}')`);
  await admin!.query(`DELETE FROM identity.orgs WHERE id IN ('${ORG_A}', '${ORG_B}')`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO identity.orgs (id, kind, name) VALUES ('${ORG_A}', 'customer', 'IT Org A'), ('${ORG_B}', 'customer', 'IT Org B')`,
  );
  await admin!.query(
    `INSERT INTO identity.users (id, idp_subject, email) VALUES
       ('${USER_A}', 'it-acc-a', 'acc-a@example.co.za'), ('${USER_B}', 'it-acc-b', 'acc-b@example.co.za')`,
  );
  await admin!.query(
    `INSERT INTO accounts.invoices (id, number, org_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents)
       VALUES ('${INVOICE_A}', 'ACC-INV-A', '${ORG_A}', '2025-11-01', '2025-11-14', 100000, 15000, 115000),
              ('${INVOICE_B}', 'ACC-INV-B', '${ORG_B}', '2025-11-01', '2025-11-14', 200000, 30000, 230000)`,
  );
  await admin!.query(
    `INSERT INTO accounts.invoice_lines (id, invoice_id, description, qty, unit_ex_vat_cents, total_ex_vat_cents)
       VALUES ('${LINE_A}', '${INVOICE_A}', 'Lamb carcass', 1, 100000, 100000)`,
  );
  await admin!.query(
    `INSERT INTO accounts.collection_actions (id, invoice_id, step, scheduled_at)
       VALUES ('${ACTION_A}', '${INVOICE_A}', 'due_notice', '2025-11-14T00:00:00.000Z')`,
  );
}

const proposal = (orgId: string, status: CreditProposal['status'] = 'approved'): CreditProposal => ({
  orgId,
  tier: 'standard',
  termsDays: 14,
  limitCents: 10_000_000,
  reasons: ['3 clean months'],
  ncaReview: false,
  proposedBy: 'system',
  status,
});

describe.skipIf(!admin)('accounts SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA identity, accounts TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity, accounts TO ${ROLE};
       GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA identity, accounts TO ${ROLE}`,
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

  describe('PgInvoicesStore', () => {
    it('reads an invoice with its lines, scoped to the session org', async () => {
      const store = new PgInvoicesStore(app!);
      const orgA = await runWithSession({ orgId: ORG_A }, () => store.get(INVOICE_A));
      expect(orgA?.number).toBe('ACC-INV-A');
      expect(orgA?.totalIncVatCents).toBe(115_000);
      expect(orgA?.lines.map((l) => l.id)).toEqual([LINE_A]);

      const orgB = await runWithSession({ orgId: ORG_B }, () => store.get(INVOICE_A));
      expect(orgB).toBeUndefined();
    });

    it('writes a new invoice and its lines inside a staff session', async () => {
      const store = new PgInvoicesStore(app!);
      const id = 'a0a70000-0000-0000-0000-0000000000a1';
      const lineId = 'a0a80000-0000-0000-0000-0000000000a1';
      await runWithSession({ staff: true }, () =>
        store.insert({
          id,
          number: 'ACC-INV-NEW',
          orgId: ORG_A,
          issuedOn: '2025-11-10',
          dueOn: '2025-11-24',
          subtotalExVatCents: 50_000,
          vatCents: 7_500,
          totalIncVatCents: 57_500,
          status: 'open',
          lines: [
            { id: lineId, description: 'Egg trays', qty: 10, unitExVatCents: 5_000, totalExVatCents: 50_000 },
          ],
        }),
      );
      const stored = await runWithSession({ staff: true }, () => store.get(id));
      expect(stored?.lines[0].description).toBe('Egg trays');

      await admin!.query(`DELETE FROM accounts.invoice_lines WHERE invoice_id = '${id}'`);
      await admin!.query(`DELETE FROM accounts.invoices WHERE id = '${id}'`);
    });
  });

  describe('PgCollectionsStore', () => {
    it('reads a collection action through the invoice it belongs to', async () => {
      const store = new PgCollectionsStore(app!);
      const orgA = await runWithSession({ orgId: ORG_A }, () => store.get(ACTION_A));
      expect(orgA?.step).toBe('due_notice');

      const orgB = await runWithSession({ orgId: ORG_B }, () => store.get(ACTION_A));
      expect(orgB).toBeUndefined();
    });

    it('records a step as done', async () => {
      const store = new PgCollectionsStore(app!);
      const doneAt = new Date().toISOString();
      await runWithSession({ staff: true }, () =>
        store.replace({ id: ACTION_A, invoiceId: INVOICE_A, step: 'due_notice', scheduledAt: '2025-11-14T00:00:00.000Z', doneAt, byUser: USER_A }),
      );
      const after = await runWithSession({ staff: true }, () => store.get(ACTION_A));
      expect(after?.doneAt).toBe(doneAt);
    });
  });

  describe('PgCreditLimitsStore', () => {
    it('upserts the live limit for an org and reads it back', async () => {
      const store = new PgCreditLimitsStore(app!);
      await runWithSession({ staff: true }, () => store.upsert(proposal(ORG_A, 'approved')));
      const read = await runWithSession({ orgId: ORG_A }, () => store.get(ORG_A));
      expect(read?.limitCents).toBe(10_000_000);
      expect(read?.status).toBe('approved');
    });

    it('updates the same row on a second upsert rather than adding one', async () => {
      const store = new PgCreditLimitsStore(app!);
      await runWithSession({ staff: true }, () => store.upsert(proposal(ORG_A, 'approved')));
      await runWithSession({ staff: true }, () =>
        store.upsert({ ...proposal(ORG_A, 'approved'), limitCents: 12_000_000 }),
      );
      const all = await runWithSession({ staff: true }, () => store.all());
      expect(all.filter((p) => p.orgId === ORG_A)).toHaveLength(1);
      expect((await runWithSession({ orgId: ORG_A }, () => store.get(ORG_A)))?.limitCents).toBe(12_000_000);
    });
  });

  describe('statement over the store', () => {
    it('builds the statement from the org invoices the session can see', async () => {
      const store = new PgInvoicesStore(app!);
      const invoices = await runWithSession({ orgId: ORG_A }, () => store.all());
      const statement = buildStatement(ORG_A, invoices, '2025-11-28');
      expect(statement.lines.map((l) => l.number)).toContain('ACC-INV-A');
      expect(statement.lines.every((l) => l.number !== 'ACC-INV-B')).toBe(true);
      expect(statement.balanceCents).toBe(115_000);
    });
  });
});
