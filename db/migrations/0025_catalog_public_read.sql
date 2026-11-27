-- Anonymous catalogue read (T-082).
--
-- The storefront must be browsable without an account, but the catalogue is not
-- uniformly public: `catalog.product_compliance` holds packer and label data,
-- and `catalog.price_lists` carries five audiences (`public`, `trader`,
-- `trade_a`, `trade_b`, `bakery`). Widening the `catalog:read` permission would
-- expose both to an anonymous caller.
--
-- So the boundary is drawn in the database, in the same shape the catalogue
-- already uses: `merch_sections_select` (0018) and `content_public_read` (0023)
-- both read `staff = 'on' OR <the row is live>`. These policies extend that
-- pattern to products, variants and price lists. Staff are unchanged; everyone
-- else sees only what is live.
--
-- The application role must be NOSUPERUSER NOBYPASSRLS and not the table owner
-- (db/README.md), or every policy here is inert. db/tests/rls.sql proves it.

-- A product is browsable when it is active, and a variant likewise. A product
-- that is inactive hides its variants too: `EXISTS` below reads the product
-- policy, so a variant cannot leak through an inactive parent.
ALTER TABLE catalog.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS products_public_read ON catalog.products;
CREATE POLICY products_public_read ON catalog.products FOR SELECT USING (
  current_setting('app.staff', true) = 'on'
  OR active);

DROP POLICY IF EXISTS products_staff_write ON catalog.products;
CREATE POLICY products_staff_write ON catalog.products FOR INSERT WITH CHECK (
  current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS products_staff_update ON catalog.products;
CREATE POLICY products_staff_update ON catalog.products FOR UPDATE USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS products_staff_delete ON catalog.products;
CREATE POLICY products_staff_delete ON catalog.products FOR DELETE USING (
  current_setting('app.staff', true) = 'on');

-- Order history reads a variant to show the SKU and temperature of a line that
-- was bought. A discontinued variant is still part of a past order, so the
-- policy cannot simply be `active`: that would erase the item from a customer's
-- own history.
--
-- The lookup goes through a SECURITY DEFINER function on purpose. Writing the
-- `EXISTS` inline would make the policy depend on the caller's SELECT privilege
-- on `sales.order_lines`, and a least-privilege role that only reads the
-- catalogue (the storefront's) would be refused the whole query with "permission
-- denied for table orders" rather than shown the catalogue. The function runs as
-- its owner and applies the same org/user scoping as `orders_owner` itself, so
-- it grants nothing the caller could not already read through their own orders.
CREATE OR REPLACE FUNCTION catalog.variant_was_ordered(p_variant uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM sales.order_lines l
      JOIN sales.orders o ON o.id = l.order_id
     WHERE l.variant_id = p_variant
       AND (current_setting('app.staff', true) = 'on'
            OR o.org_id::text = current_setting('app.org_id', true)
            OR o.customer_user_id::text = current_setting('app.user_id', true)));
$$;

REVOKE ALL ON FUNCTION catalog.variant_was_ordered(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION catalog.variant_was_ordered(uuid) TO PUBLIC;

ALTER TABLE catalog.variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS variants_public_read ON catalog.variants;
CREATE POLICY variants_public_read ON catalog.variants FOR SELECT USING (
  current_setting('app.staff', true) = 'on'
  OR (active
      AND EXISTS (SELECT 1 FROM catalog.products p WHERE p.id = variants.product_id))
  OR catalog.variant_was_ordered(variants.id));

DROP POLICY IF EXISTS variants_staff_write ON catalog.variants;
CREATE POLICY variants_staff_write ON catalog.variants FOR INSERT WITH CHECK (
  current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS variants_staff_update ON catalog.variants;
CREATE POLICY variants_staff_update ON catalog.variants FOR UPDATE USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS variants_staff_delete ON catalog.variants;
CREATE POLICY variants_staff_delete ON catalog.variants FOR DELETE USING (
  current_setting('app.staff', true) = 'on');

-- A price list is public only when it is published, the audience is `public`,
-- and today is inside its [valid_from, valid_to) window. `superseded` lists are
-- deliberately excluded even though their window may still be open: a newer list
-- for the same audience has replaced them. `isListLive` in the pricing domain
-- applies the same three tests, so the policy and the service cannot disagree
-- about which list is current.
ALTER TABLE catalog.price_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_lists_public_read ON catalog.price_lists;
CREATE POLICY price_lists_public_read ON catalog.price_lists FOR SELECT USING (
  current_setting('app.staff', true) = 'on'
  OR (status = 'published'
      AND audience = 'public'
      AND valid_from <= now()
      AND (valid_to IS NULL OR valid_to > now())));

DROP POLICY IF EXISTS price_lists_staff_write ON catalog.price_lists;
CREATE POLICY price_lists_staff_write ON catalog.price_lists FOR INSERT WITH CHECK (
  current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS price_lists_staff_update ON catalog.price_lists;
CREATE POLICY price_lists_staff_update ON catalog.price_lists FOR UPDATE USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS price_lists_staff_delete ON catalog.price_lists;
CREATE POLICY price_lists_staff_delete ON catalog.price_lists FOR DELETE USING (
  current_setting('app.staff', true) = 'on');

-- Items inherit their list's visibility (the subquery is subject to the policy
-- above), so a `trader` price cannot be read by guessing a list id. This is the
-- `content_products` pattern from 0023.
ALTER TABLE catalog.price_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS price_list_items_read ON catalog.price_list_items;
CREATE POLICY price_list_items_read ON catalog.price_list_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM catalog.price_lists p WHERE p.id = price_list_id));

DROP POLICY IF EXISTS price_list_items_staff_write ON catalog.price_list_items;
CREATE POLICY price_list_items_staff_write ON catalog.price_list_items FOR ALL USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');

-- The order-history subquery in `variants_public_read` probes
-- `sales.order_lines` by variant, and that column has no index today. Without
-- one the policy turns every anonymous variant read into a sequential scan of
-- the order lines.
CREATE INDEX IF NOT EXISTS order_lines_variant_id_idx ON sales.order_lines (variant_id);
