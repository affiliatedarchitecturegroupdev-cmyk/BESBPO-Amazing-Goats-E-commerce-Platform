-- The trade account application (T-024) records what the applicant declared:
-- their registration number, declared turnover and POPIA consent, none of which
-- 0006 captured. Four columns, no table rewrite. Uploaded documents already live
-- in accounts.documents, and the decision columns (decision, decided_by,
-- second_approver, decided_at) are reused for the approval workflow.
ALTER TABLE accounts.credit_applications ADD COLUMN registration_number text;
ALTER TABLE accounts.credit_applications ADD COLUMN turnover_declared_cents bigint;
ALTER TABLE accounts.credit_applications ADD COLUMN consent_given boolean NOT NULL DEFAULT false;
ALTER TABLE accounts.credit_applications ADD COLUMN decision_reason text;
