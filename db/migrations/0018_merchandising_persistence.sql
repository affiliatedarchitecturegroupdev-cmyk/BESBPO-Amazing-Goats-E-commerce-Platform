-- The merchandising SQL adapter (T-062) persists curated storefront sections in
-- the tables migration 0003 already created for exactly this purpose:
-- `catalog.merch_sections` / `catalog.merch_items` (see docs/09-data-model.md and
-- `merchandising.store.ts`). The card named `commerce.merchandising_*`; there is
-- no `commerce` schema (0001 creates the ten per-context schemas) and the whole
-- repository — the data-model doc, the domain types and the store comment —
-- points at `catalog.merch_*`, so the adapter lands over those rather than
-- duplicating them. This migration adds the domain-id bridge the other adapters
-- use and the row-level security the tables never had.
--
-- The domain id is an opaque string (`sec_home_hero`); the schema keys the
-- section on a serial integer. Carry the domain id as a unique `external_id`, the
-- same bridge orders, price lists, campaigns and partner rows use.

ALTER TABLE catalog.merch_sections ADD COLUMN external_id text;
CREATE UNIQUE INDEX merch_sections_external_id_key ON catalog.merch_sections (external_id);

-- Curated sections are editorial content: staff manage them, the public sees the
-- live ones. Management is staff-only (app.staff = 'on'); a storefront read with
-- no staff setting sees only a section that is active and inside its half-open
-- [starts_at, ends_at) window, so a draft or an expired strip never leaks early.
-- The window here matches the domain's `isSectionVisible`; the service re-applies
-- it, so the rule and the policy cannot drift into showing different rows.
ALTER TABLE catalog.merch_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY merch_sections_select ON catalog.merch_sections FOR SELECT USING (
  current_setting('app.staff', true) = 'on'
  OR (active
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())));
CREATE POLICY merch_sections_insert ON catalog.merch_sections FOR INSERT WITH CHECK (
  current_setting('app.staff', true) = 'on');
CREATE POLICY merch_sections_update ON catalog.merch_sections FOR UPDATE USING (
  current_setting('app.staff', true) = 'on') WITH CHECK (
  current_setting('app.staff', true) = 'on');
CREATE POLICY merch_sections_delete ON catalog.merch_sections FOR DELETE USING (
  current_setting('app.staff', true) = 'on');

-- A section's items inherit its visibility (the subquery is itself subject to the
-- policy above), so an item shows exactly when its section does. Writes are
-- staff-only, as for the parent.
ALTER TABLE catalog.merch_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY merch_items_select ON catalog.merch_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM catalog.merch_sections s WHERE s.id = section_id));
CREATE POLICY merch_items_insert ON catalog.merch_items FOR INSERT WITH CHECK (
  current_setting('app.staff', true) = 'on');
CREATE POLICY merch_items_update ON catalog.merch_items FOR UPDATE USING (
  current_setting('app.staff', true) = 'on') WITH CHECK (
  current_setting('app.staff', true) = 'on');
CREATE POLICY merch_items_delete ON catalog.merch_items FOR DELETE USING (
  current_setting('app.staff', true) = 'on');
