-- The commerce SQL adapters (T-046) need a few columns and two output tables
-- that the hand-written schema did not carry. Every column is additive and the
-- two tables are new, so no table rewrite.

-- Price lists are a workflow (draft -> pending approval -> published, then
-- superseded by the next list for the audience). 0003 modelled validity and the
-- approver but not the status or who asked, so the SQL store could not persist
-- the two-person rule. Default 'published' so a list that already existed stays
-- live when the column lands.
ALTER TABLE catalog.price_lists ADD COLUMN status text NOT NULL DEFAULT 'published'
  CHECK (status IN ('draft', 'pending_approval', 'published', 'superseded'));
ALTER TABLE catalog.price_lists ADD COLUMN requested_by uuid;
ALTER TABLE catalog.price_lists ADD COLUMN published_at timestamptz;
-- The pricing domain id is a string (e.g. `pl_demo_public`); the schema keys on
-- a uuid. Carry the domain id as `external_id`, the same bridge orders use.
ALTER TABLE catalog.price_lists ADD COLUMN external_id text;
CREATE UNIQUE INDEX price_lists_external_id_key ON catalog.price_lists (external_id);

-- The order domain id is a string (`ord_<epoch ms>`); the schema keys on a uuid.
ALTER TABLE sales.orders ADD COLUMN external_id text;
CREATE UNIQUE INDEX orders_external_id_key ON sales.orders (external_id);

-- The cycle domain id is deterministic (`<class>:<cut-off ISO>`), which is what
-- makes one cycle per cut-off. Keep the uuid primary key and carry the domain id
-- as `code`; orders reference cycles.id, and the adapter resolves a code to its
-- uuid.
ALTER TABLE sales.cycles ADD COLUMN code text;
CREATE UNIQUE INDEX cycles_code_key ON sales.cycles (code);

-- At cut-off the cycle engine writes a pick list and one draft purchase order
-- per supplier kind. These are derived outputs of a closed cycle, so their lines
-- are stored as a jsonb payload rather than normalised rows.
CREATE TABLE sales.pick_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES sales.cycles(id) ON DELETE CASCADE,
  lines jsonb NOT NULL,
  total_units numeric(12,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE sales.cycle_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES sales.cycles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  lines jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
