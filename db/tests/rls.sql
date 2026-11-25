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
GRANT USAGE ON SCHEMA sales, accounts, ads, identity, catalog, notifications, logistics TO ag_rls_test;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sales, accounts, ads, identity, catalog, notifications, logistics TO ag_rls_test;
-- Serial keys (catalog.merch_sections.id) draw from a sequence, so an INSERT
-- needs USAGE on it; the application role needs the same grant (db/README.md).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sales, accounts, ads, identity, catalog, notifications, logistics TO ag_rls_test;

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

-- Merchandising sections are editorial content: the public sees the active,
-- in-window ones, and only staff may write (migration 0018). Inserted here as the
-- superuser (RLS bypassed, as for every other fixture), then read under the app
-- role below.
INSERT INTO catalog.merch_sections (code, title, page, sort, active, starts_at, ends_at) VALUES
  ('RLS-MERCH-LIVE', 'RLS live', 'home', 0, true, NULL, NULL),
  ('RLS-MERCH-DRAFT', 'RLS draft', 'home', 1, false, NULL, NULL),
  ('RLS-MERCH-EXPIRED', 'RLS expired', 'home', 2, true, now() - interval '2 days', now() - interval '1 day');
INSERT INTO catalog.merch_items (section_id, variant_id, sort) VALUES
  ((SELECT id FROM catalog.merch_sections WHERE code = 'RLS-MERCH-LIVE'), '00000000-0000-0000-0000-00000000a001', 0),
  ((SELECT id FROM catalog.merch_sections WHERE code = 'RLS-MERCH-DRAFT'), '00000000-0000-0000-0000-00000000a001', 0);

-- Content is editorial too (migrations 0023, 0024): a published recipe is public,
-- a draft is not, and a recipe's detail and product links must not be more
-- visible than the recipe itself. Inserted as the superuser, read as the app
-- role below.
INSERT INTO catalog.content (id, kind, slug, title, body_md, status, published_at) VALUES
  ('c0000000-0000-0000-0000-00000000c001', 'recipe', 'rls-published-recipe', 'RLS published recipe', 'Published body.', 'published', now()),
  ('c0000000-0000-0000-0000-00000000c002', 'recipe', 'rls-draft-recipe', 'RLS draft recipe', 'Draft body.', 'draft', NULL);
INSERT INTO catalog.content_recipes (content_id, servings, prep_minutes, cook_minutes, ingredients, steps) VALUES
  ('c0000000-0000-0000-0000-00000000c001', 4, 10, 20, '[{"item":"lamb"}]'::jsonb, '[{"text":"Cook it."}]'::jsonb),
  ('c0000000-0000-0000-0000-00000000c002', 2, 5, 5, '[{"item":"secret"}]'::jsonb, '[{"text":"Not yet."}]'::jsonb);
INSERT INTO catalog.content_products (content_id, variant_id) VALUES
  ('c0000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000a001'),
  ('c0000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000a001');

-- MFA enrolments are a credential per subject (migration 0019). The secret is
-- stored encrypted and a subject reads only their own row. `subject_ref` is the
-- domain id: the same value the gateway sets as `app.user_id`.
INSERT INTO identity.mfa_enrolments (subject_ref, secret_encrypted, confirmed_at) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'v1:rls-a:tag:body', now()),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'v1:rls-b:tag:body', NULL);

-- Proof of delivery (migration 0020). The driver app keys a proof by the stop,
-- which it derives from the order, so the stop ref is the order's domain id. A
-- customer must see the proof of their own delivery and no other.
UPDATE sales.orders SET external_id = 'rls-order-a' WHERE id = '0a000000-0000-0000-0000-000000000001';
UPDATE sales.orders SET external_id = 'rls-order-b' WHERE id = '0b000000-0000-0000-0000-000000000002';
INSERT INTO logistics.proof_of_delivery (stop_ref, signature_url, temperature_c, temperature_excursion, captured_at) VALUES
  ('rls-order-a', 'T. Dlamini', 3.4, false, now()),
  ('rls-order-b', 'N. Mokoena', 9.2, true, now());

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
SELECT pg_temp.assert_eq((SELECT count(*) FROM identity.mfa_enrolments), 0, 'mfa default deny');
SELECT pg_temp.assert_eq((SELECT count(*) FROM logistics.proof_of_delivery), 0, 'proof default deny');

-- Staff bypass. Savepoints (not COMMIT) keep everything inside the outer
-- transaction so the final ROLLBACK undoes the whole test.
SAVEPOINT s;
  SET LOCAL app.staff = 'on';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM sales.orders), 2, 'orders staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM accounts.invoices), 2, 'invoices staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM ads.campaigns), 2, 'campaigns staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.messages), 2, 'messages staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM notifications.consent), 2, 'consent staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM identity.mfa_enrolments), 2, 'mfa staff sees all');
  SELECT pg_temp.assert_eq((SELECT count(*) FROM logistics.proof_of_delivery), 2, 'proof staff sees all');
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

-- A subject sees only their own MFA enrolment (migration 0019); staff see all.
SAVEPOINT s;
  SET LOCAL app.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM identity.mfa_enrolments), 1, 'mfa user A sees own');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM identity.mfa_enrolments WHERE subject_ref = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0,
    'mfa user A cannot see B');
ROLLBACK TO SAVEPOINT s;

-- A customer sees the proof of their own delivery, and no other (migration 0020).
SAVEPOINT s;
  SET LOCAL app.user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM logistics.proof_of_delivery), 1, 'proof user A sees own');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM logistics.proof_of_delivery WHERE stop_ref = 'rls-order-b'), 0,
    'proof user A cannot see B');
ROLLBACK TO SAVEPOINT s;

-- The org the order belongs to sees it too, so a trade account's staff can
-- answer a delivery query without holding a driver role.
SAVEPOINT s;
  SET LOCAL app.org_id = '11111111-1111-1111-1111-111111111111';
  SELECT pg_temp.assert_eq((SELECT count(*) FROM logistics.proof_of_delivery), 1, 'proof org A sees own');
ROLLBACK TO SAVEPOINT s;

-- Merchandising sections are editorial content: the public sees the active,
-- in-window ones, and only staff may write (migration 0018). The fixtures were
-- inserted above; here the app role reads them.
--
-- The public (no staff setting) sees only the live strip and its items.
SAVEPOINT s;
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.merch_sections WHERE code LIKE 'RLS-MERCH-%'), 1,
    'merch sections: public sees only the live strip');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.merch_items), 1,
    'merch items: public sees only the live strip''s items');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.merch_items i
       JOIN catalog.merch_sections s ON s.id = i.section_id
      WHERE s.code = 'RLS-MERCH-DRAFT'), 0,
    'merch items: a draft strip''s items stay hidden');
ROLLBACK TO SAVEPOINT s;

-- Staff see every section, including drafts and expired strips.
SAVEPOINT s;
  SET LOCAL app.staff = 'on';
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.merch_sections WHERE code LIKE 'RLS-MERCH-%'), 3,
    'merch sections: staff sees all');
ROLLBACK TO SAVEPOINT s;

-- Content: the public reads published recipes only, and a draft's detail and
-- product links are invisible along with the draft itself (migrations 0023, 0024).
SAVEPOINT s;
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.content WHERE slug LIKE 'rls-%-recipe'), 1,
    'content: public sees only the published recipe');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.content_recipes WHERE content_id = 'c0000000-0000-0000-0000-00000000c001'), 1,
    'content_recipes: public sees the published recipe''s detail');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.content_recipes WHERE content_id = 'c0000000-0000-0000-0000-00000000c002'), 0,
    'content_recipes: a draft recipe''s detail stays hidden');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.content_products WHERE content_id = 'c0000000-0000-0000-0000-00000000c002'), 0,
    'content_products: a draft recipe''s product links stay hidden');
ROLLBACK TO SAVEPOINT s;

-- Staff see the draft and its detail.
SAVEPOINT s;
  SET LOCAL app.staff = 'on';
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.content WHERE slug LIKE 'rls-%-recipe'), 2,
    'content: staff sees drafts');
  SELECT pg_temp.assert_eq(
    (SELECT count(*) FROM catalog.content_recipes WHERE content_id = 'c0000000-0000-0000-0000-00000000c002'), 1,
    'content_recipes: staff sees a draft recipe''s detail');
ROLLBACK TO SAVEPOINT s;

-- A recipe is not writable by the public: an unauthenticated insert is refused
-- by the policy, not merely discouraged.
SAVEPOINT s;
  DO $$
  BEGIN
    INSERT INTO catalog.content (kind, slug, title, body_md, status)
    VALUES ('recipe', 'rls-sneaky-recipe', 'Sneaky', '', 'published');
    RAISE EXCEPTION 'content: public INSERT was allowed, the write policy is not enforced';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END $$;
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
