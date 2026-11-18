-- MFA enrolments (T-063). The identity service kept these in memory, so a
-- restart silently un-enrolled every staff member, which defeats the "MFA for
-- all staff" rule in docs/02-access-control.md.
--
-- A second factor is a credential, so the TOTP secret is encrypted at rest
-- (field-level, as docs/02-access-control.md requires). The application reads
-- it back through `@ag/db`'s `FieldCipher` (AES-256-GCM), so a database dump or
-- a leaked backup does not disclose a secret that can mint valid codes.

CREATE TABLE identity.mfa_enrolments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The subject's domain id: the same value the service passes and the caller
  -- id the gateway puts in `app.user_id`, so a subject reads only their own row.
  subject_ref text NOT NULL,
  -- `v1:<iv>:<tag>:<ciphertext>`, base64url; never the plaintext secret.
  secret_encrypted text NOT NULL,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX mfa_enrolments_subject_ref_key ON identity.mfa_enrolments (subject_ref);
CREATE TRIGGER mfa_enrolments_updated BEFORE UPDATE ON identity.mfa_enrolments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Default deny: a staff session sees every enrolment, a subject sees only their
-- own. The USING expression doubles as the WITH CHECK, so a subject can only
-- create or update a row that is their own — the same shape as `users_owner`
-- (migration 0016).
ALTER TABLE identity.mfa_enrolments ENABLE ROW LEVEL SECURITY;
CREATE POLICY mfa_enrolments_owner ON identity.mfa_enrolments USING (
  current_setting('app.staff', true) = 'on'
  OR subject_ref = current_setting('app.user_id', true));
