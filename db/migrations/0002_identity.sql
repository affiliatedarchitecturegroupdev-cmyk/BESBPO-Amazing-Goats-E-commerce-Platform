CREATE TABLE identity.orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind org_kind NOT NULL, name text NOT NULL, reg_no text, vat_no text,
  entity_type text, turnover_declared_cents bigint, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), idp_subject text UNIQUE NOT NULL, email citext UNIQUE NOT NULL, full_name text, phone text,
  mfa_enrolled boolean NOT NULL DEFAULT false, status text NOT NULL DEFAULT 'active', marketing_opt_in boolean NOT NULL DEFAULT false,
  consent_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE identity.roles (code text PRIMARY KEY, description text);
CREATE TABLE identity.permissions (code text PRIMARY KEY, description text);
CREATE TABLE identity.role_permissions (role_code text REFERENCES identity.roles(code), permission_code text REFERENCES identity.permissions(code), PRIMARY KEY (role_code, permission_code));
CREATE TABLE identity.user_roles (user_id uuid REFERENCES identity.users(id), role_code text REFERENCES identity.roles(code), granted_by uuid, granted_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz, PRIMARY KEY (user_id, role_code));
CREATE TABLE identity.org_members (org_id uuid REFERENCES identity.orgs(id), user_id uuid REFERENCES identity.users(id), member_role text NOT NULL DEFAULT 'buyer', PRIMARY KEY (org_id, user_id));
CREATE TABLE identity.api_keys (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid REFERENCES identity.orgs(id), name text, key_hash text NOT NULL, scopes text[] NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz);
CREATE TABLE identity.elevation_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requested_by uuid NOT NULL, permission text NOT NULL, reason text NOT NULL, approved_by uuid, starts_at timestamptz, ends_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE TRIGGER orgs_updated BEFORE UPDATE ON identity.orgs FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER users_updated BEFORE UPDATE ON identity.users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
