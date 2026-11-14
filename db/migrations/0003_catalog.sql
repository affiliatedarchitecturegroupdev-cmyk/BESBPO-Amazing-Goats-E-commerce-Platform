CREATE TABLE catalog.product_lines (id serial PRIMARY KEY, code text UNIQUE NOT NULL, name text NOT NULL, grp text NOT NULL, phase smallint NOT NULL CHECK (phase IN (1,2,3)));
CREATE TABLE catalog.categories (id serial PRIMARY KEY, slug text UNIQUE NOT NULL, name text NOT NULL, parent_id int REFERENCES catalog.categories(id), sort int NOT NULL DEFAULT 0);
CREATE TABLE catalog.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), line_id int NOT NULL REFERENCES catalog.product_lines(id), category_id int REFERENCES catalog.categories(id),
  slug text UNIQUE NOT NULL, name text NOT NULL, description text, halaal_available boolean NOT NULL DEFAULT false, active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE catalog.variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid NOT NULL REFERENCES catalog.products(id), sku text UNIQUE NOT NULL, pack text, unit text NOT NULL,
  fulfilment fulfilment_type NOT NULL, temperature temperature_class NOT NULL, channel channel_type NOT NULL DEFAULT 'both', phase smallint NOT NULL,
  source_kind text NOT NULL, weight_g integer, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON catalog.variants (product_id); CREATE INDEX ON catalog.variants (fulfilment, channel);
CREATE TABLE catalog.product_compliance (
  variant_id uuid PRIMARY KEY REFERENCES catalog.variants(id), rule_set text NOT NULL, class_or_grade text, packer_name text, pack_station_no text,
  label_text text, certificate_expiry date, notes text
);
CREATE TABLE catalog.media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_id uuid REFERENCES catalog.products(id), url text NOT NULL, alt text, sort int NOT NULL DEFAULT 0, credit text);
CREATE TABLE catalog.price_lists (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, name text NOT NULL, audience text NOT NULL CHECK (audience IN ('public','trader','trade_a','trade_b','bakery')), valid_from timestamptz NOT NULL, valid_to timestamptz, approved_by uuid);
CREATE TABLE catalog.price_list_items (price_list_id uuid REFERENCES catalog.price_lists(id), variant_id uuid REFERENCES catalog.variants(id), price_ex_vat_cents bigint NOT NULL CHECK (price_ex_vat_cents >= 0), unit_price_basis text NOT NULL DEFAULT 'each', PRIMARY KEY (price_list_id, variant_id));
CREATE TABLE catalog.bundles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, name text NOT NULL, occasion text, active boolean NOT NULL DEFAULT true);
CREATE TABLE catalog.bundle_items (bundle_id uuid REFERENCES catalog.bundles(id), variant_id uuid REFERENCES catalog.variants(id), qty int NOT NULL DEFAULT 1, PRIMARY KEY (bundle_id, variant_id));
CREATE TABLE catalog.merch_sections (id serial PRIMARY KEY, code text UNIQUE NOT NULL, title text NOT NULL, page text NOT NULL, sort int NOT NULL DEFAULT 0, active boolean NOT NULL DEFAULT true, starts_at timestamptz, ends_at timestamptz);
CREATE TABLE catalog.merch_items (section_id int REFERENCES catalog.merch_sections(id), variant_id uuid REFERENCES catalog.variants(id), sort int NOT NULL DEFAULT 0, badge text, PRIMARY KEY (section_id, variant_id));
CREATE TRIGGER products_updated BEFORE UPDATE ON catalog.products FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER variants_updated BEFORE UPDATE ON catalog.variants FOR EACH ROW EXECUTE FUNCTION set_updated_at();
