-- Dairy and fresh produce onboarding (T-033).
--
-- Brings two partner suppliers onto the platform: a dairy (approved dairy, no
-- repacking) and a fresh-produce grower (graded, packed and marked by supplier).
-- Both must lodge a Certificate of Acceptability (R638 of 2018); see
-- docs/07-compliance.md and services/commerce/src/onboarding/supplier-onboarding.ts
-- for the rule set and the document kinds.
--
-- The rows mirror `identity.orgs` (kind) and `partners.documents` (kind,
-- storage_url, expires_on, verified). Run after 002_catalogue_import.sql.

BEGIN;

-- 1. Supplier organisations.
INSERT INTO identity.orgs (id, kind, name, reg_no)
VALUES
  ('d0000000-0000-0000-0000-0000000000d1', 'dairy', 'Rietfontein Dairy', 'DAIRY-2024-0142'),
  ('00000000-0000-0000-0000-0000000000f1', 'grower', 'Vaal Valley Produce', 'PROD-2024-0099')
ON CONFLICT (id) DO NOTHING;

-- 2. Lodged documents. The dairy's cold-chain attestation is deliberately left
--    out so the onboarding check reports it as pending (a document not lodged).
INSERT INTO partners.documents (partner_org_id, kind, storage_url, expires_on, verified)
VALUES
  ('d0000000-0000-0000-0000-0000000000d1', 'dairy_approval', 's3://ag-partners/rietfontein/dairy-approval.pdf', current_date + 300, true),
  ('d0000000-0000-0000-0000-0000000000d1', 'r638_certificate_of_acceptability', 's3://ag-partners/rietfontein/coa.pdf', current_date + 120, true),
  ('d0000000-0000-0000-0000-0000000000d1', 'tax_clearance', 's3://ag-partners/rietfontein/tax.pdf', current_date + 60, true),
  ('00000000-0000-0000-0000-0000000000f1', 'produce_grading_declaration', 's3://ag-partners/vaal-valley/grading.pdf', current_date + 180, true),
  ('00000000-0000-0000-0000-0000000000f1', 'r638_certificate_of_acceptability', 's3://ag-partners/vaal-valley/coa.pdf', current_date + 90, true),
  ('00000000-0000-0000-0000-0000000000f1', 'cold_chain_attestation', 's3://ag-partners/vaal-valley/cold-chain.pdf', NULL, true),
  ('00000000-0000-0000-0000-0000000000f1', 'tax_clearance', 's3://ag-partners/vaal-valley/tax.pdf', current_date + 45, true)
ON CONFLICT DO NOTHING;

COMMIT;
