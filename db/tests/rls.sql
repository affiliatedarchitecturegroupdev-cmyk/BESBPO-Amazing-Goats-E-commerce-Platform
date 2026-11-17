-- Row-level security integration test (T-002).
--
-- Run through scripts/test-rls.sh (psql -v ON_ERROR_STOP=1). Any wrong row
-- count raises and the script exits non-zero, so this is a real test, not a
-- smoke check.
--
-- It proves three things the migrations promise:
--   * default deny: with no app.* settings, nothing is visible;
--   * scoping: an org sees its own rows and no others, a user sees their own;
--   * staff bypass: app.staff = 'on' sees everything.
-- It also demonstrates the trap this task exists to close: a superuser (and a
-- table owner) bypasses RLS entirely, so the application must connect as a
-- NOSUPERUSER, NOBYPASSRLS role (see db/README.md).

BEGIN;

-- A stand-in for the application role.
DROP ROLE IF EXISTS ag_rls_test;
CREATE ROLE ag_rls_test LOGIN PASSWORD 'test' NOSUPERUSER NOBYPASSRLS;
GRANT USAGE ON SCHEMA sales, accounts, ads, identity, catalog, notifications TO ag_rls_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sales, accounts, ads, identity, catalog, notifications TO ag_rls_test;

-- Minimal catalogue row so order lines have a variant to reference.
INSERT INTO catalog.product_lines (code, name, grp, phase) VALUES ('RLS', 'RLS line', 'test', 1);
INSERT INTO catalog.products (id, line_id, slug, name) VALUES
  ('c0000000-0000-0000-0000-000000000001', (SELECT id FROM catalog.product_lines WHERE code = 'RLS'), 'rls-product', 'RLS product');
INSERT INTO catalog.variants (id, product_id, sku, unit, fulfilment, temperature, channel, phase, source_kind) VALUES
  ('00000000-0000-0000-0000-00000000a001', 'c0000000-0000-0000-0000-000000000001', 'RLS-1', 'each', 'in_stock', 'ambient', 'both', 1, 'test');

-- Two tenants, one customer each, one order / invoice / campaign each.
INSERT INTO identity.orgs (id, kind, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'customer', 'RLS Org A'),
  ('22222222-2222-2222-2222-222222222222', 'customer', 'RLS Org B');
INSERT INTO identity.users (id, idp_subject, email) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rls-sub-a', 'rls-a@example.co.za'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rls-sub-b', 'rls-b@example.co.za');
INSERT INTO sales.orders (id, customer_user_id, org_id) VALUES
  ('0a000000-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111'),
  ('0b000000-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222');
INSERT INTO sales.order_lines (id, order_id, variant_id, qty, unit_price_ex_vat_cents, fulfilment) VALUES
  ('01a00000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000a001', 1, 10000, 'in_stock');
INSERT INTO accounts.invoices (id, number, org_id, issued_on, due_on, subtotal_ex_vat_cents, vat_cents, total_inc_vat_cents) VALUES
  ('1a000000-0000-0000-0000-000000000001', 'RLS-INV-A', '11111111-1111-1111-1111-111111111111', current_date, current_date + 30, 10000, 1500, 11500),
  ('1b000000-0000-0000-0000-000000000002', 'RLS-INV-B', '22222222-2222-2222-2222-222222222222', current_date, current_date + 30, 20000, 3000, 23000);
INSERT INTO accounts.invoice_lines (id, invoice_id, description, qty, unit_ex_vat_cents, total_ex_vat_cents) VALUES
  ('11a00000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'RLS line A', 1, 10000, 10000),
  ('11b00000-0000-0000-0000-000000000002', '1b000000-0000-0000-0000-000000000002', 'RLS line B', 1, 20000, 20000);
INSERT INTO ads.campaigns (id, advertiser_org_id, name, budget_cents, pricing) VALUES
  ('2a000000-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'RLS Campaign A', 100000, 'flat'),
  ('2b000000-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'RLS Campaign B', 100000, 'flat');

-- The dispatch log and consent are support-only records (migration 0017), so a
-- non-staff session must see none of them.
INSERT INTO notifications.messages (id, channel, template_key, contact_ref, status, reason) VALUES
  ('RLS-MSG-A', 'email', 'order_confirmation', 'rls-a', 'sent', 'transactional'),
  ('RLS-MSG-B', 'sms', 'cutoff_reminder', 'rls-b', 'sent', 'transactional');
INSERT INTO notifications.consent (contact_ref, marketing) VALUES
  ('rls-a', ARRAY['email']::text[]),
  ('rls-b', ARRAY['sms']::text[]);

CREATE FUNCTION pg_temp.assert_eq(actual bigint, expected bigint, label text) RETURNS void AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'RLS FAIL: % expected %, got %', label, expected, actual;
  END IF;
  RAISE NOTICE 'ok: % (=%)', label, actual;
END; $$ LANGUAGE plpgsql;

-- The application role.
SET ROLE ag_rls_test;

-- Default deny.
SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders), 0, 'orders default deny');
SELECT pg_temp.assert_eq((SELECT count(*) FROM accounts.invoices), 0, 'invoices default deny');
SELECT pg_temp.assert_eq((SELECT count(*) FROM ads.campaigns), 0, 'campaigns default deny');
SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.messages), 0, 'messages default deny');
SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.consent), 0, 'consent default deny');

-- Staff bypass. Savepoints (not COMMIT) keep everything inside the outer
-- transaction so the final ROLLBACK undoes the whole test.
SAVEPOINT s;
  SET LOCAL app.staff = 'on';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders), 2, 'orders staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM accounts.invoices), 2, 'invoices staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM ads.campaigns), 2, 'campaigns staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.messages), 2, 'messages staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.consent), 2, 'consent staff sees all');
ROLLBACK TO SAVEPOINT s;

-- Org A sees only its own rows.
SAVEPOINT s;
  SET LOCAL app.org_id = '11111111-1111-1111-1111-111111111111';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders), 1, 'orders org A sees own');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders WHERE org_id = '22222222-2222-2222-2222-222222222222'), 0, 'orders org A cannot see B');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM accounts.invoices), 1, 'invoices org A sees own');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM ads.campaigns), 1, 'campaigns org A sees own');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.messages), 0, 'messages org A sees none (support-only)');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.consent), 0, 'consent org A sees none (support-only)');
ROLLBACK TO SAVEPOINT s;

-- Org B sees only its own rows.
SAVEPOINT s;
  SET LOCAL app.org_id = '22222222-2222-2222-2222-222222222222';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders), 1, 'orders org B sees own');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM accounts.invoices), 1, 'invoices org B sees own');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM ads.campaigns), 1, 'campaigns org B sees own');
ROLLBACK TO SAVEPOINT s;

-- A customer with only app.user_id sees their own order.
SAVEPOINT s;
  SET LOCAL app.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders), 1, 'orders user A sees own');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders WHERE customer_user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'orders user A cannot see B');
ROLLBACK TO SAVEPOINT s;

-- Children inherit the parent's visibility.
SAVEPOINT s;
  SET LOCAL app.org_id = '11111111-1111-1111-1111-111111111111';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.order_lines), 1, 'order_lines org A sees own');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM accounts.invoice_lines), 1, 'invoice_lines org A sees own');
ROLLBACK TO SAVEPOINT s;

RESET ROLE;

-- The trap: a superuser bypasses RLS, so the app must not connect as one.
SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders), 2, 'superuser bypasses RLS (app role must not be superuser)');

ROLLBACK;
