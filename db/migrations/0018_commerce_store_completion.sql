-- The remaining commerce SQL adapters (T-051) need bridge columns, a few columns
-- the hand-written schema did not carry, one new table, and the row-level
-- security the new customer-facing tables need. Every change is additive (or a
-- relaxation of a NOT NULL the domain cannot satisfy), so no table is rewritten.
--
-- The commerce domain keys on opaque string ids (`pr_new`, `sub_1`, `org_1`,
-- `sec_1`) while the schema keys on uuids. An `external_id`/`*_ref` text column
-- carries the domain id, the same bridge T-046..T-048 use.

-- promotions: the domain promotion carries a name, a workflow status
-- (draft -> approved -> ended), stackability, a minimum spend and the SKUs it is
-- limited to. 0005 modelled only code/kind/value/percent/window/approver, so the
-- SQL store could not persist the workflow or the targeting.
ALTER TABLE sales.promotions ADD COLUMN external_id text;
CREATE UNIQUE INDEX promotions_external_id_key ON sales.promotions (external_id);
ALTER TABLE sales.promotions ADD COLUMN name text;
ALTER TABLE sales.promotions ADD COLUMN status text NOT NULL DEFAULT 'draft'
  CHECK (status IN ('draft', 'approved', 'ended'));
ALTER TABLE sales.promotions ADD COLUMN stackable boolean NOT NULL DEFAULT false;
ALTER TABLE sales.promotions ADD COLUMN min_spend_cents bigint;
ALTER TABLE sales.promotions ADD COLUMN skus text[];
ALTER TABLE sales.promotions ADD COLUMN max_uses_per_customer integer;

-- A draft promotion is not public: only staff see it; approved and ended
-- promotions are visible to anyone (a cart must price against them). This is
-- default-deny for drafts, so an unauthenticated read cannot leak an unpublished
-- code.
ALTER TABLE sales.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY promotions_visible ON sales.promotions USING (
  status <> 'draft'
  OR current_setting('app.staff', true) = 'on');

-- merchandising is not repeated here: `0018_merchandising_persistence.sql` (T-062)
-- already adds `catalog.merch_sections.external_id` and the RLS both merch tables
-- need. Two migrations adding the same column is a hard failure on a fresh
-- database, which is how this duplicate was caught.

-- subscriptions: the domain id, cadence and next run were not modelled (0005 had
-- only `every_weeks`, which the domain does not use). The customer and bundle are
-- domain ids, so the uuid foreign keys are relaxed and the domain ids carried in
-- `*_ref` columns.
ALTER TABLE sales.subscriptions ADD COLUMN external_id text;
CREATE UNIQUE INDEX subscriptions_external_id_key ON sales.subscriptions (external_id);
ALTER TABLE sales.subscriptions ADD COLUMN cadence text
  CHECK (cadence IN ('weekly', 'fortnightly', 'monthly'));
ALTER TABLE sales.subscriptions ADD COLUMN next_run_at timestamptz;
ALTER TABLE sales.subscriptions ADD COLUMN skipped text[] NOT NULL DEFAULT '{}';
ALTER TABLE sales.subscriptions ALTER COLUMN every_weeks DROP NOT NULL;
ALTER TABLE sales.subscriptions ADD COLUMN customer_user_ref text;
ALTER TABLE sales.subscriptions ALTER COLUMN customer_user_id DROP NOT NULL;
ALTER TABLE sales.subscriptions ADD COLUMN bundle_ref text;
ALTER TABLE sales.subscriptions ALTER COLUMN bundle_id DROP NOT NULL;
-- Re-scope to the owner whether the customer is a uuid or a domain id.
DROP POLICY subscriptions_owner ON sales.subscriptions;
CREATE POLICY subscriptions_owner ON sales.subscriptions USING (
  current_setting('app.staff', true) = 'on'
  OR customer_user_id::text = current_setting('app.user_id', true)
  OR customer_user_ref = current_setting('app.user_id', true));

-- standing orders: the domain id, the free-text delivery window and the line set
-- were not modelled. Lines are edited wholesale by the admin screen, so they are
-- stored as a jsonb payload on the parent (the sales.pick_lists precedent) — the
-- domain variant id is an opaque string, not a catalog uuid, so it cannot be a
-- foreign key.
ALTER TABLE sales.standing_orders ADD COLUMN external_id text;
CREATE UNIQUE INDEX standing_orders_external_id_key ON sales.standing_orders (external_id);
ALTER TABLE sales.standing_orders ADD COLUMN lines jsonb NOT NULL DEFAULT '[]';
ALTER TABLE sales.standing_orders ADD COLUMN org_ref text;
ALTER TABLE sales.standing_orders ALTER COLUMN org_id DROP NOT NULL;
DROP POLICY standing_owner ON sales.standing_orders;
CREATE POLICY standing_owner ON sales.standing_orders USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true)
  OR org_ref = current_setting('app.org_id', true));

-- supplier onboarding had no table: the application and its lodged documents
-- lived only in memory. The organisation is named by a domain string, so it is
-- the primary key. Onboarding is a staff workflow, so only a staff session sees
-- the rows.
CREATE TABLE partners.supplier_applications (
  org_name text PRIMARY KEY,
  kind text NOT NULL,
  documents jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE partners.supplier_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY supplier_applications_staff ON partners.supplier_applications USING (
  current_setting('app.staff', true) = 'on');
