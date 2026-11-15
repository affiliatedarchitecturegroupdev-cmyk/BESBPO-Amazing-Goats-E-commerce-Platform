import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PgDb, runWithSession } from '@ag/db';
import { PgIntentStore } from './intents/intents.sql-store';
import { PgRefundsStore } from './refunds/refunds.sql-store';
import { PgPayoutsStore } from './payouts/payouts.sql-store';
import { PgChargebacksStore } from './chargebacks/chargebacks.sql-store';
import { PgReconciliationStore } from './reconciliation/reconciliation.sql-store';
import { PgWebhookStore } from './webhooks/webhooks.sql-store';
import type { PaymentIntent } from './providers/payment-intent';

/**
 * Integration test for the payments SQL adapters against a real Postgres. It
 * runs only when DATABASE_URL is set (the CI `db` job); otherwise it is skipped
 * so the default unit run needs no database.
 *
 * A superuser and a table owner BYPASS row-level security, so asserting scoping
 * through the admin connection would prove nothing. The test therefore
 * provisions its own NOSUPERUSER, NOBYPASSRLS role — the shape `db/README.md`
 * requires of the application — and connects as it, then proves the adapters
 * read only the rows the session is allowed to see.
 */
const adminUrl = process.env.DATABASE_URL;
const admin = adminUrl ? new PgDb(adminUrl) : undefined;

const ROLE = 'ag_payments_it';
const PASSWORD = 'ag_payments_it';

const ORG_A = 'd0a00000-0000-0000-0000-0000000000a1';
const ORG_B = 'd0b00000-0000-0000-0000-0000000000b2';
const USER_A = 'd0a10000-0000-0000-0000-0000000000a1';
const USER_B = 'd0b10000-0000-0000-0000-0000000000b2';
const ORDER_A = 'd0a20000-0000-0000-0000-0000000000a1';
const ORDER_B = 'd0b20000-0000-0000-0000-0000000000b2';
const LINE_A = 'd0aa0000-0000-0000-0000-0000000000a1';
const INVOICE_A = 'd0a30000-0000-0000-0000-0000000000a1';
const INTENT_A = 'd0a40000-0000-0000-0000-0000000000a1';
const INTENT_B = 'd0b40000-0000-0000-0000-0000000000b2';
const PAYMENT_A = 'd0a50000-0000-0000-0000-0000000000a1';
const PAYMENT_B = 'd0b50000-0000-0000-0000-0000000000b2';
const REFUND_A = 'd0a60000-0000-0000-0000-0000000000a1';
const PAYOUT_A = 'd0a70000-0000-0000-0000-0000000000a1';
const CHARGEBACK_A = 'd0a80000-0000-0000-0000-0000000000a1';
const SETTLEMENT = 'd0a90000-0000-0000-0000-0000000000a1';
const PRODUCT = 'd0c00000-0000-0000-0000-0000000000c1';
const VARIANT = 'd0c10000-0000-0000-0000-0000000000c1';
const EVENT_ID = 'evt_it_1';

/** Builds an application connection string by swapping the credentials. */
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
  await admin!.query(`DELETE FROM payments.provider_events WHERE provider = 'peach' AND event_id = '${EVENT_ID}'`);
  await admin!.query(`DELETE FROM payments.chargebacks WHERE id = '${CHARGEBACK_A}'`);
  await admin!.query(`DELETE FROM payments.settlement_lines WHERE settlement_id = '${SETTLEMENT}'`);
  await admin!.query(`DELETE FROM payments.settlements WHERE id = '${SETTLEMENT}'`);
  await admin!.query(`DELETE FROM payments.refunds WHERE id = '${REFUND_A}'`);
  await admin!.query(`DELETE FROM payments.payouts WHERE id = '${PAYOUT_A}'`);
  await admin!.query(`DELETE FROM payments.payments WHERE id IN ('${PAYMENT_A}', '${PAYMENT_B}')`);
  await admin!.query(`DELETE FROM payments.intents WHERE id IN ('${INTENT_A}', '${INTENT_B}')`);
  await admin!.query(`DELETE FROM sales.order_lines WHERE id = '${LINE_A}'`);
  await admin!.query(`DELETE FROM accounts.invoices WHERE id = '${INVOICE_A}'`);
  await admin!.query(`DELETE FROM sales.orders WHERE id IN ('${ORDER_A}', '${ORDER_B}')`);
  await admin!.query(`DELETE FROM catalog.variants WHERE id = '${VARIANT}'`);
  await admin!.query(`DELETE FROM catalog.products WHERE id = '${PRODUCT}'`);
  await admin!.query(`DELETE FROM catalog.product_lines WHERE code = 'IT'`);
  await admin!.query(`DELETE FROM identity.users WHERE id IN ('${USER_A}', '${USER_B}')`);
  await admin!.query(`DELETE FROM identity.orgs WHERE id IN ('${ORG_A}', '${ORG_B}')`);
}

async function seedFixtures(): Promise<void> {
  await admin!.query(
    `INSERT INTO identity.orgs (id, kind, name) VALUES ('${ORG_A}', 'customer', 'IT Org A'), ('${ORG_B}', 'customer', 'IT Org B')`,
  );
  await admin!.query(
    `INSERT INTO identity.users (id, idp_subject, email) VALUES
       ('${USER_A}', 'it-sub-a', 'it-a@example.co.za'), ('${USER_B}', 'it-sub-b', 'it-b@example.co.za')`,
  );
  await admin!.query(
    `INSERT INTO catalog.product_lines (code, name, grp, phase) VALUES ('IT', 'IT line', 'test', 1)`,
  );
  await admin!.query(
    `INSERT INTO catalog.products (id, line_id, slug, name)
       VALUES ('${PRODUCT}', (SELECT id FROM catalog.product_lines WHERE code = 'IT'), 'it-product', 'IT product')`,
  );
  await admin!.query(
    `INSERT INTO catalog.variants (id, product_id, sku, unit, fulfilment, temperature, channel, phase, source_kind)
       VALUES ('${VARIANT}', '${PRODUCT}', 'IT-1', 'each', 'in_stock', 'ambient', 'both', 1, 'test')`,
  );
  await admin!.query(
    `INSERT INTO sales.orders (id, customer_user_id, org_id) VALUES
       ('${ORDER_A}', '${USER_A}', '${ORG_A}'), ('${ORDER_B}', '${USER_B}', '${ORG_B}')`,
  );
  await admin!.query(
    `INSERT INTO sales.order_lines (id, order_id, variant_id, qty, unit_price_ex_vat_cents, fulfilment)
       VALUES ('${LINE_A}', '${ORDER_A}', '${VARIANT}', 1, 10000, 'in_stock')`,
  );
  await admin!.query(
    `INSERT INTO accounts.invoices (id, number, org_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents)
       VALUES ('${INVOICE_A}', 'IT-INV-A', '${ORG_A}', current_date, current_date + 30, 10000, 1500, 11500)`,
  );
  await admin!.query(
    `INSERT INTO payments.intents (id, order_id, method, amount_inc_vat_cents, currency, provider, provider_ref, status, idempotency_key)
       VALUES
         ('${INTENT_A}', '${ORDER_A}', 'card', 11500, 'ZAR', 'peach', 'ch_it_a', 'pending', 'it-key-a'),
         ('${INTENT_B}', '${ORDER_B}', 'card', 23000, 'ZAR', 'peach', 'ch_it_b', 'pending', 'it-key-b')`,
  );
  await admin!.query(
    `INSERT INTO payments.payments (id, intent_id, provider, provider_ref, amount_cents, status)
       VALUES ('${PAYMENT_A}', '${INTENT_A}', 'peach', 'pay_it_a', 11500, 'succeeded'),
              ('${PAYMENT_B}', '${INTENT_B}', 'peach', 'pay_it_b', 23000, 'succeeded')`,
  );
  await admin!.query(
    `INSERT INTO payments.refunds (id, payment_id, amount_cents, reason, requested_by, status)
       VALUES ('${REFUND_A}', '${PAYMENT_A}', 11500, 'it refund', '${USER_A}', 'requested')`,
  );
  await admin!.query(
    `INSERT INTO payments.payouts (id, payee_org_id, amount_cents, requested_by, status)
       VALUES ('${PAYOUT_A}', '${ORG_A}', 10000, '${USER_A}', 'requested')`,
  );
  await admin!.query(
    `INSERT INTO payments.chargebacks (id, payment_id, payout_id, provider, amount_cents, reason, status)
       VALUES ('${CHARGEBACK_A}', '${PAYMENT_A}', '${PAYOUT_A}', 'peach', 11500, 'it chargeback', 'received')`,
  );
  await admin!.query(
    `INSERT INTO payments.settlements (id, provider, period_start, period_end, gross_cents, fees_cents, net_cents, bank_ref, matched)
       VALUES ('${SETTLEMENT}', 'peach', current_date - 7, current_date, 11500, 300, 11200, 'IT-BANK', false)`,
  );
  await admin!.query(
    `INSERT INTO payments.settlement_lines (settlement_id, payment_id, amount_cents)
       VALUES ('${SETTLEMENT}', '${PAYMENT_A}', 11500)`,
  );
}

describe.skipIf(!admin)('payments SQL adapters (integration)', () => {
  beforeAll(async () => {
    await cleanFixtures();
    await dropRole();
    await admin!.query(`CREATE ROLE ${ROLE} LOGIN PASSWORD '${PASSWORD}' NOSUPERUSER NOBYPASSRLS`);
    await admin!.query(
      `GRANT USAGE ON SCHEMA identity, catalog, sales, accounts, payments TO ${ROLE};
       GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity, catalog, sales, accounts, payments TO ${ROLE}`,
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

  describe('PgIntentStore', () => {
    it('reads an intent by id, idempotency key and provider reference', async () => {
      const store = new PgIntentStore(app!);
      const byId = await runWithSession({ staff: true }, () => store.getById(INTENT_A));
      expect(byId?.amountIncVatCents).toBe(11500);
      expect(byId?.providerRef).toBe('ch_it_a');

      const byKey = await runWithSession({ staff: true }, () =>
        store.getByIdempotencyKey('it-key-a'),
      );
      expect(byKey?.id).toBe(INTENT_A);

      const byRef = await runWithSession({ staff: true }, () =>
        store.findByProviderRef('ch_it_a'),
      );
      expect(byRef?.id).toBe(INTENT_A);
    });

    it('saves a new intent and updates its status on conflict', async () => {
      const store = new PgIntentStore(app!);
      const intent: PaymentIntent = {
        id: 'd0d00000-0000-0000-0000-0000000000d1',
        method: 'card',
        amountIncVatCents: 5000,
        currency: 'ZAR',
        status: 'created',
        idempotencyKey: 'it-key-new',
        createdAt: new Date().toISOString(),
      };
      const saved = await runWithSession({ staff: true }, () => store.save(intent));
      expect(saved.id).toBe(intent.id);

      const updated = await runWithSession({ staff: true }, () =>
        store.save({ ...intent, status: 'succeeded', provider: 'peach', providerRef: 'ch_new' }),
      );
      expect(updated.status).toBe('succeeded');
      expect(updated.providerRef).toBe('ch_new');

      await admin!.query(`DELETE FROM payments.intents WHERE id = '${intent.id}'`);
    });

    it('scopes reads to the session org, and staff sees every org', async () => {
      const store = new PgIntentStore(app!);
      const orgA = await runWithSession({ orgId: ORG_A }, () => store.list());
      expect(orgA.map((i) => i.id)).toEqual([INTENT_A]);

      const staff = await runWithSession({ staff: true }, () => store.list());
      expect(staff.map((i) => i.id).sort()).toEqual([INTENT_A, INTENT_B].sort());
    });
  });

  describe('PgRefundsStore', () => {
    it('reads a refund only when its payment is visible to the session', async () => {
      const store = new PgRefundsStore(app!);
      const orgA = await runWithSession({ orgId: ORG_A }, () => store.get(REFUND_A));
      expect(orgA?.amountCents).toBe(11500);

      const orgB = await runWithSession({ orgId: ORG_B }, () => store.get(REFUND_A));
      expect(orgB).toBeUndefined();
    });

    it('inserts and updates a refund', async () => {
      const store = new PgRefundsStore(app!);
      const created = await runWithSession({ staff: true }, () =>
        store.insert({
          id: 'd0d10000-0000-0000-0000-0000000000d1',
          paymentId: PAYMENT_A,
          amountCents: 500,
          reason: 'partial',
          requestedBy: USER_A,
          status: 'requested',
        }),
      );
      expect(created.amountCents).toBe(500);

      const approved = await runWithSession({ staff: true }, () =>
        store.replace({ ...created, status: 'approved', approvedBy: USER_B }),
      );
      expect(approved.status).toBe('approved');
      expect(approved.approvedBy).toBe(USER_B);

      await admin!.query(`DELETE FROM payments.refunds WHERE id = '${created.id}'`);
    });
  });

  describe('PgPayoutsStore', () => {
    it('scopes a payout to its payee org', async () => {
      const store = new PgPayoutsStore(app!);
      const orgA = await runWithSession({ orgId: ORG_A }, () => store.get(PAYOUT_A));
      expect(orgA?.payeeOrgId).toBe(ORG_A);

      const orgB = await runWithSession({ orgId: ORG_B }, () => store.get(PAYOUT_A));
      expect(orgB).toBeUndefined();
    });
  });

  describe('PgChargebacksStore', () => {
    it('reads a chargeback through the payment it disputes', async () => {
      const store = new PgChargebacksStore(app!);
      const orgA = await runWithSession({ orgId: ORG_A }, () => store.get(CHARGEBACK_A));
      expect(orgA?.payoutId).toBe(PAYOUT_A);

      const orgB = await runWithSession({ orgId: ORG_B }, () => store.get(CHARGEBACK_A));
      expect(orgB).toBeUndefined();
    });
  });

  describe('PgReconciliationStore', () => {
    it('reads settlements, lines and known payments, and records the outcome', async () => {
      const store = new PgReconciliationStore(app!);
      const settlements = await runWithSession({ staff: true }, () => store.settlements());
      expect(settlements.map((s) => s.id)).toContain(SETTLEMENT);

      const lines = await runWithSession({ staff: true }, () => store.lines());
      expect(lines.find((l) => l.settlementId === SETTLEMENT)?.paymentId).toBe(PAYMENT_A);

      const known = await runWithSession({ staff: true }, () => store.knownPaymentIds());
      expect(known.has(PAYMENT_A)).toBe(true);

      await runWithSession({ staff: true }, () => store.markMatched(SETTLEMENT, true));
      const after = await runWithSession({ staff: true }, () => store.settlements());
      expect(after.find((s) => s.id === SETTLEMENT)?.matched).toBe(true);
    });
  });

  describe('PgWebhookStore', () => {
    it('records an event once and reports a retried delivery as a duplicate', async () => {
      const store = new PgWebhookStore(app!);
      const event = {
        provider: 'peach',
        eventId: EVENT_ID,
        signatureOk: true,
        payload: { id: EVENT_ID },
        receivedAt: new Date().toISOString(),
      };
      const first = await runWithSession({ staff: true }, () => store.record(event));
      expect(first.stored).toBe(true);

      const second = await runWithSession({ staff: true }, () => store.record(event));
      expect(second.stored).toBe(false);
      expect(second.event.eventId).toBe(EVENT_ID);

      const all = await runWithSession({ staff: true }, () => store.list());
      expect(all.filter((e) => e.eventId === EVENT_ID)).toHaveLength(1);
    });
  });
});
