CREATE TABLE sales.cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), product_class text NOT NULL, cutoff_at timestamptz NOT NULL, trade_lock_at timestamptz, top_up_until timestamptz,
  slaughter_on timestamptz, delivery_from timestamptz NOT NULL, delivery_to timestamptz NOT NULL, status cycle_status NOT NULL DEFAULT 'scheduled', capacity_units integer
);
CREATE TABLE sales.cycle_capacity (cycle_id uuid REFERENCES sales.cycles(id), variant_id uuid REFERENCES catalog.variants(id), capacity numeric(12,3) NOT NULL, booked numeric(12,3) NOT NULL DEFAULT 0, PRIMARY KEY (cycle_id, variant_id));
CREATE TABLE sales.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), number bigserial UNIQUE, customer_user_id uuid REFERENCES identity.users(id), org_id uuid REFERENCES identity.orgs(id),
  cycle_id uuid REFERENCES sales.cycles(id), status order_status NOT NULL DEFAULT 'pending_payment', delivery_address jsonb, slot_id uuid,
  subtotal_ex_vat_cents bigint NOT NULL DEFAULT 0, delivery_fee_cents bigint NOT NULL DEFAULT 0, vat_cents bigint NOT NULL DEFAULT 0, total_inc_vat_cents bigint NOT NULL DEFAULT 0,
  payment_method text, notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON sales.orders (customer_user_id); CREATE INDEX ON sales.orders (org_id); CREATE INDEX ON sales.orders (cycle_id, status);
CREATE TABLE sales.order_lines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES sales.orders(id), variant_id uuid NOT NULL REFERENCES catalog.variants(id), qty numeric(12,3) NOT NULL CHECK (qty > 0), unit_price_ex_vat_cents bigint NOT NULL, fulfilment fulfilment_type NOT NULL, batch_id uuid REFERENCES inventory.batches(id), substitution_pref text);
CREATE TABLE sales.order_events (id bigserial PRIMARY KEY, order_id uuid NOT NULL REFERENCES sales.orders(id), kind text NOT NULL, data jsonb, at timestamptz NOT NULL DEFAULT now(), by_user uuid);
CREATE TABLE sales.standing_orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), org_id uuid NOT NULL REFERENCES identity.orgs(id), day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), delivery_window text, paused_until date, active boolean NOT NULL DEFAULT true);
CREATE TABLE sales.standing_order_lines (standing_order_id uuid REFERENCES sales.standing_orders(id), variant_id uuid REFERENCES catalog.variants(id), qty numeric(12,3) NOT NULL, PRIMARY KEY (standing_order_id, variant_id));
CREATE TABLE sales.reservations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_user_id uuid REFERENCES identity.users(id), variant_id uuid REFERENCES catalog.variants(id), qty int NOT NULL DEFAULT 1, deposit_cents bigint NOT NULL, collect_on date, status text NOT NULL DEFAULT 'held');
CREATE TABLE sales.quotes (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), requester_user_id uuid, org_id uuid, details jsonb NOT NULL, status text NOT NULL DEFAULT 'open', quoted_cents bigint, valid_until date);
CREATE TABLE sales.subscriptions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_user_id uuid REFERENCES identity.users(id), bundle_id uuid REFERENCES catalog.bundles(id), every_weeks smallint NOT NULL, next_cycle_id uuid REFERENCES sales.cycles(id), paused boolean NOT NULL DEFAULT false);
CREATE TABLE sales.promotions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE, kind text NOT NULL, value_cents bigint, percent numeric(5,2), starts_at timestamptz, ends_at timestamptz, approved_by uuid);
CREATE TABLE sales.gift_cards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE NOT NULL, balance_cents bigint NOT NULL, expires_at date);
CREATE TABLE sales.reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), variant_id uuid REFERENCES catalog.variants(id), user_id uuid REFERENCES identity.users(id), rating smallint CHECK (rating BETWEEN 1 AND 5), body text, photo_url text, approved boolean NOT NULL DEFAULT false);
CREATE TRIGGER orders_updated BEFORE UPDATE ON sales.orders FOR EACH ROW EXECUTE FUNCTION set_updated_at();
