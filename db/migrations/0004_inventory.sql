CREATE TABLE inventory.batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_code text UNIQUE NOT NULL, variant_id uuid REFERENCES catalog.variants(id),
  source_org_id uuid REFERENCES identity.orgs(id), processor_org_id uuid REFERENCES identity.orgs(id), slaughtered_on date, packed_on date, use_by date,
  gross_weight_g bigint, grade text, halaal_certified boolean NOT NULL DEFAULT false, temperature_status text NOT NULL DEFAULT 'ok', status text NOT NULL DEFAULT 'quarantine' CHECK (status IN ('quarantine','released','held','recalled','consumed')),
  released_by uuid, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inventory.stock_levels (batch_id uuid REFERENCES inventory.batches(id), location text NOT NULL, qty numeric(12,3) NOT NULL CHECK (qty >= 0), reserved numeric(12,3) NOT NULL DEFAULT 0, PRIMARY KEY (batch_id, location));
CREATE TABLE inventory.stock_movements (id bigserial PRIMARY KEY, batch_id uuid REFERENCES inventory.batches(id), kind text NOT NULL, qty numeric(12,3) NOT NULL, ref_type text, ref_id text, at timestamptz NOT NULL DEFAULT now(), by_user uuid);
CREATE TABLE inventory.temperature_logs (id bigserial PRIMARY KEY, subject_type text NOT NULL, subject_id uuid NOT NULL, celsius numeric(4,1) NOT NULL, at timestamptz NOT NULL, source text NOT NULL DEFAULT 'probe');
CREATE INDEX ON inventory.temperature_logs (subject_type, subject_id, at);
CREATE TABLE inventory.recalls (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), batch_id uuid REFERENCES inventory.batches(id), reason text NOT NULL, opened_by uuid NOT NULL, opened_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz);
