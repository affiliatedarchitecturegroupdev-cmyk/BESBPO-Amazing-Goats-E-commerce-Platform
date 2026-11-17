-- The identity, logistics and stock SQL adapters (T-047) need bridge columns and
-- one new table. Every change is additive (or a relaxation of a NOT NULL the
-- domain cannot satisfy), so no table is rewritten.
--
-- The services use opaque string ids (`usr_...`, `batch_AG-...`, `rc_...`) while
-- the schema keys on uuids. An `external_id`/`*_ref` text column carries the
-- domain id; where a real foreign key is needed the adapter resolves it to the
-- uuid. Logistics routes, slots and sync events already use uuids, so they need
-- no bridge.

-- identity: the domain ids for users and organisations, and the actor id on
-- role grants.
ALTER TABLE identity.users ADD COLUMN external_id text;
CREATE UNIQUE INDEX users_external_id_key ON identity.users (external_id);
ALTER TABLE identity.orgs ADD COLUMN external_id text;
CREATE UNIQUE INDEX orgs_external_id_key ON identity.orgs (external_id);
ALTER TABLE identity.user_roles ADD COLUMN granted_by_ref text;

-- Break-glass elevations: the domain's own fields. `requested_by` was a uuid the
-- domain cannot supply (its actors are string ids), so it is relaxed to nullable
-- and the domain ids are carried in `*_ref` columns.
ALTER TABLE identity.elevation_requests ALTER COLUMN requested_by DROP NOT NULL;
ALTER TABLE identity.elevation_requests ADD COLUMN external_id text;
CREATE UNIQUE INDEX elevation_requests_external_id_key ON identity.elevation_requests (external_id);
ALTER TABLE identity.elevation_requests ADD COLUMN subject_ref text;
ALTER TABLE identity.elevation_requests ADD COLUMN requested_by_ref text;
ALTER TABLE identity.elevation_requests ADD COLUMN approved_by_ref text;
ALTER TABLE identity.elevation_requests ADD COLUMN role text;
ALTER TABLE identity.elevation_requests ADD COLUMN minutes integer;

-- Role changes had no table: the two-person rule (request, then a different
-- approver) lived only in memory. Subject and actors are staff identities, so
-- they are stored as the domain's text ids.
CREATE TABLE identity.role_change_requests (
  external_id text PRIMARY KEY,
  subject_id text NOT NULL,
  from_roles text[] NOT NULL,
  to_roles text[] NOT NULL,
  requested_by text NOT NULL,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- logistics: the domain ids for routes, slots and driver sync events (the domain
-- uses `r1`/`s1`/`e1` style ids, not uuids).
ALTER TABLE logistics.routes ADD COLUMN external_id text;
CREATE UNIQUE INDEX routes_external_id_key ON logistics.routes (external_id);
ALTER TABLE logistics.routes ADD COLUMN capacity_boxes integer;
ALTER TABLE logistics.slots ADD COLUMN external_id text;
CREATE UNIQUE INDEX slots_external_id_key ON logistics.slots (external_id);
ALTER TABLE logistics.sync_events ADD COLUMN external_id text;
CREATE UNIQUE INDEX sync_events_external_id_key ON logistics.sync_events (external_id);
ALTER TABLE logistics.sync_events ADD COLUMN driver_ref text;
ALTER TABLE logistics.sync_events ADD COLUMN stop_ref text;
ALTER TABLE logistics.sync_events ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- inventory: the domain ids for batches and recalls, and the temperature subject
-- (a batch id today), which need not be a uuid.
ALTER TABLE inventory.batches ADD COLUMN external_id text;
CREATE UNIQUE INDEX batches_external_id_key ON inventory.batches (external_id);
ALTER TABLE inventory.batches ADD COLUMN pack text;
-- A recall's affected order ids are not a foreign key (an order id is a domain
-- string), and its opener is a domain id, so `opened_by` is relaxed to nullable.
ALTER TABLE inventory.recalls ADD COLUMN external_id text;
CREATE UNIQUE INDEX recalls_external_id_key ON inventory.recalls (external_id);
ALTER TABLE inventory.recalls ADD COLUMN affected_order_ids text[];
ALTER TABLE inventory.recalls ALTER COLUMN opened_by DROP NOT NULL;
ALTER TABLE inventory.recalls ADD COLUMN opened_by_ref text;
ALTER TABLE inventory.temperature_logs ALTER COLUMN subject_id DROP NOT NULL;
ALTER TABLE inventory.temperature_logs ADD COLUMN external_id text;
CREATE UNIQUE INDEX temperature_logs_external_id_key ON inventory.temperature_logs (external_id);
ALTER TABLE inventory.temperature_logs ADD COLUMN subject_ref text;
CREATE INDEX temperature_logs_subject_ref_idx ON inventory.temperature_logs (subject_ref, at);

-- Identity holds personal data (email, phone, staff roles), so it is default
-- deny: a staff request sees everything, a customer sees only their own account
-- and organisation. The gateway sets app.staff, app.org_id and app.user_id after
-- RBAC, exactly as 0010/0011 describe.
ALTER TABLE identity.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_owner ON identity.users USING (
  current_setting('app.staff', true) = 'on'
  OR id::text = current_setting('app.user_id', true));
ALTER TABLE identity.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_owner ON identity.user_roles USING (
  current_setting('app.staff', true) = 'on'
  OR user_id::text = current_setting('app.user_id', true));
ALTER TABLE identity.org_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_members_owner ON identity.org_members USING (
  current_setting('app.staff', true) = 'on'
  OR org_id::text = current_setting('app.org_id', true)
  OR user_id::text = current_setting('app.user_id', true));
-- Role changes and break-glass elevations are staff-only records: only a staff
-- session (app.staff = 'on') may see them.
ALTER TABLE identity.elevation_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY elevation_requests_owner ON identity.elevation_requests USING (
  current_setting('app.staff', true) = 'on');
ALTER TABLE identity.role_change_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY role_change_requests_owner ON identity.role_change_requests USING (
  current_setting('app.staff', true) = 'on');
