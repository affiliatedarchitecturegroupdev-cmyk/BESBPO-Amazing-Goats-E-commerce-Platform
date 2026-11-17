-- The ads, partners and notifications SQL adapters (T-048) need bridge columns,
-- a few columns the hand-written schema did not carry, and a notifications
-- schema that did not exist yet. Every change is additive (or a relaxation of a
-- NOT NULL the domain cannot satisfy), so no table is rewritten.
--
-- The services use opaque string ids (`org-demo`, `slot-mon`, `PO-118`) while
-- the schema keys on uuids. An `external_id`/`*_ref` text column carries the
-- domain id, the same bridge T-046/T-047 use.

-- ads: the advertiser is an organisation domain id (`org-demo`), so the
-- campaign and ledger carry it as `advertiser_org_ref`. The campaign review
-- workflow (submitted -> decided) is stored on the campaign.
ALTER TABLE ads.campaigns ADD COLUMN advertiser_org_ref text;
ALTER TABLE ads.campaigns ADD COLUMN submitted_at timestamptz;
ALTER TABLE ads.campaigns ADD COLUMN reviewed_by_ref text;
ALTER TABLE ads.campaigns ADD COLUMN decided_at timestamptz;
ALTER TABLE ads.campaigns ADD COLUMN decision_reason text;
CREATE INDEX campaigns_advertiser_org_ref_idx ON ads.campaigns (advertiser_org_ref);

-- A creative's reviewer is a domain id, and the review carries a timestamp.
ALTER TABLE ads.creatives ADD COLUMN reviewed_by_ref text;
ALTER TABLE ads.creatives ADD COLUMN reviewed_at timestamptz;

-- The wallet ledger is keyed by the advertiser organisation domain id.
ALTER TABLE ads.wallet_ledger ADD COLUMN advertiser_org_ref text;
CREATE INDEX wallet_ledger_advertiser_org_ref_idx ON ads.wallet_ledger (advertiser_org_ref);

-- The advertiser-owned rows must be visible to the advertiser whether their
-- organisation is a uuid or a domain string, so the policies match either.
DROP POLICY campaigns_owner ON ads.campaigns;
CREATE POLICY campaigns_owner ON ads.campaigns USING (
  current_setting('app.staff', true) = 'on'
  OR advertiser_org_id::text = current_setting('app.org_id', true)
  OR advertiser_org_ref = current_setting('app.org_id', true));
DROP POLICY wallet_ledger_owner ON ads.wallet_ledger;
CREATE POLICY wallet_ledger_owner ON ads.wallet_ledger USING (
  current_setting('app.staff', true) = 'on'
  OR advertiser_org_id::text = current_setting('app.org_id', true)
  OR advertiser_org_ref = current_setting('app.org_id', true));

-- partners: the domain ids for slots, purchase orders and documents, and the
-- fields the partner portal shows (a day label, a document name, a PO code).
-- The domain carries a day label ("Mon"), not a date, so `slot_on` is relaxed
-- and the label is stored in `day_label`.
ALTER TABLE partners.slots ADD COLUMN external_id text;
CREATE UNIQUE INDEX partner_slots_external_id_key ON partners.slots (external_id);
ALTER TABLE partners.slots ADD COLUMN partner_org_ref text;
ALTER TABLE partners.slots ALTER COLUMN partner_org_id DROP NOT NULL;
ALTER TABLE partners.slots ALTER COLUMN slot_on DROP NOT NULL;
ALTER TABLE partners.slots ADD COLUMN day_label text;
ALTER TABLE partners.slots ADD COLUMN confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE partners.purchase_orders ADD COLUMN external_id text;
CREATE UNIQUE INDEX partner_purchase_orders_external_id_key ON partners.purchase_orders (external_id);
ALTER TABLE partners.purchase_orders ADD COLUMN partner_org_ref text;
ALTER TABLE partners.purchase_orders ALTER COLUMN partner_org_id DROP NOT NULL;
ALTER TABLE partners.purchase_orders ALTER COLUMN kind DROP NOT NULL;
ALTER TABLE partners.purchase_orders ADD COLUMN code text;
ALTER TABLE partners.purchase_orders ADD COLUMN description text;
ALTER TABLE partners.purchase_orders ADD COLUMN day_label text;
ALTER TABLE partners.purchase_orders ADD COLUMN grades text;

ALTER TABLE partners.documents ADD COLUMN external_id text;
CREATE UNIQUE INDEX partner_documents_external_id_key ON partners.documents (external_id);
ALTER TABLE partners.documents ADD COLUMN partner_org_ref text;
ALTER TABLE partners.documents ALTER COLUMN partner_org_id DROP NOT NULL;
ALTER TABLE partners.documents ALTER COLUMN kind DROP NOT NULL;
ALTER TABLE partners.documents ALTER COLUMN storage_url DROP NOT NULL;
ALTER TABLE partners.documents ADD COLUMN name text;

-- Partner rows are visible to the owning organisation, by uuid or domain id.
DROP POLICY partner_slots_owner ON partners.slots;
CREATE POLICY partner_slots_owner ON partners.slots USING (
  current_setting('app.staff', true) = 'on'
  OR partner_org_id::text = current_setting('app.org_id', true)
  OR partner_org_ref = current_setting('app.org_id', true));
DROP POLICY partner_documents_owner ON partners.documents;
CREATE POLICY partner_documents_owner ON partners.documents USING (
  current_setting('app.staff', true) = 'on'
  OR partner_org_id::text = current_setting('app.org_id', true)
  OR partner_org_ref = current_setting('app.org_id', true));
DROP POLICY po_owner ON partners.purchase_orders;
CREATE POLICY po_owner ON partners.purchase_orders USING (
  current_setting('app.staff', true) = 'on'
  OR partner_org_id::text = current_setting('app.org_id', true)
  OR partner_org_ref = current_setting('app.org_id', true));

-- notifications: the dispatch log and per-channel consent had no tables; they
-- lived only in memory. The dispatch log is append-only in practice (a record is
-- written once per send), so `id` is the domain's own string id.
CREATE SCHEMA IF NOT EXISTS notifications;
CREATE TABLE notifications.messages (
  id text PRIMARY KEY,
  channel text NOT NULL,
  template_key text NOT NULL,
  contact_ref text NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  provider_ref text,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_messages_channel_idx ON notifications.messages (channel, at);

-- Consent is per channel (a customer can allow email but not WhatsApp), which a
-- single `identity.users.marketing_opt_in` boolean cannot express.
CREATE TABLE notifications.consent (
  contact_ref text PRIMARY KEY,
  marketing text[] NOT NULL DEFAULT '{}',
  consent_at timestamptz
);

-- The dispatch log and consent are support-only records (the routes are behind
-- `support:manage`), so only a staff session sees them; default deny otherwise.
ALTER TABLE notifications.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_messages_staff ON notifications.messages USING (
  current_setting('app.staff', true) = 'on');
ALTER TABLE notifications.consent ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_consent_staff ON notifications.consent USING (
  current_setting('app.staff', true) = 'on');
