-- Conventions: uuid primary keys, created_at/updated_at, money in integer cents (ZAR, excluding VAT), times in UTC.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS citext;
CREATE SCHEMA IF NOT EXISTS identity; CREATE SCHEMA IF NOT EXISTS catalog; CREATE SCHEMA IF NOT EXISTS inventory;
CREATE SCHEMA IF NOT EXISTS sales; CREATE SCHEMA IF NOT EXISTS accounts; CREATE SCHEMA IF NOT EXISTS logistics;
CREATE SCHEMA IF NOT EXISTS payments; CREATE SCHEMA IF NOT EXISTS ads; CREATE SCHEMA IF NOT EXISTS partners; CREATE SCHEMA IF NOT EXISTS audit;

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TYPE fulfilment_type AS ENUM ('in_stock','pre_order_cycle','reservation','quote','seasonal_pre_order');
CREATE TYPE temperature_class AS ENUM ('live','chilled','frozen','ambient');
CREATE TYPE channel_type AS ENUM ('both','public_only','trade_only');
CREATE TYPE credit_tier AS ENUM ('new','probation','standard','preferred');
CREATE TYPE order_status AS ENUM ('pending_payment','confirmed','in_cycle','packing','out_for_delivery','delivered','cancelled','refunded');
CREATE TYPE cycle_status AS ENUM ('scheduled','open','locked','closed','fulfilled');
CREATE TYPE org_kind AS ENUM ('customer','trade_account','partner_farm','abattoir','co_packer','dairy','grower','advertiser','internal');

CREATE TABLE audit.audit_log (
  id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), actor_user_id uuid, actor_roles text[],
  action text NOT NULL, entity text NOT NULL, entity_id text, before jsonb, after jsonb, ip inet, request_id text, approved_by uuid
);
CREATE TABLE audit.data_access_log (
  id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), actor_user_id uuid NOT NULL, subject_type text NOT NULL, subject_id text NOT NULL, purpose text
);
-- Append-only: block updates and deletes.
CREATE OR REPLACE FUNCTION audit.block_mutation() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'audit tables are append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER audit_log_immutable BEFORE UPDATE OR DELETE ON audit.audit_log FOR EACH ROW EXECUTE FUNCTION audit.block_mutation();
CREATE TRIGGER data_access_immutable BEFORE UPDATE OR DELETE ON audit.data_access_log FOR EACH ROW EXECUTE FUNCTION audit.block_mutation();
