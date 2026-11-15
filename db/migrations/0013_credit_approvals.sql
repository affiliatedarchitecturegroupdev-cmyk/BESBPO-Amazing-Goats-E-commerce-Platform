-- Credit limits are proposed by the system (evaluateTier) and approved by a
-- person. 0006 recorded the proposal and a single approver; the approval
-- workflow (T-025) needs a status so a proposal is not a live limit before it is
-- approved, a second approver for large limits, and the NCA review flag the
-- tiering function computes. Four columns, no table rewrite.
ALTER TABLE accounts.credit_limits ADD COLUMN status text NOT NULL DEFAULT 'proposed'
  CHECK (status IN ('proposed', 'approved', 'rejected'));
ALTER TABLE accounts.credit_limits ADD COLUMN second_approver uuid;
ALTER TABLE accounts.credit_limits ADD COLUMN nca_review boolean NOT NULL DEFAULT false;

-- At most one live limit per org: the proposed or approved row is the one in
-- force, and the store keys on it. Rejected proposals are exempt, so they stay
-- as history without blocking a fresh application.
CREATE UNIQUE INDEX credit_limits_org_live_key
  ON accounts.credit_limits (org_id)
  WHERE status <> 'rejected';
