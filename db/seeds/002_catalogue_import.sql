-- Catalogue import (T-003): map db/seeds/catalogue_v1.csv (140 sellable rows)
-- into catalog.product_lines, catalog.products, catalog.variants and
-- catalog.product_compliance.
--
-- Load the staged CSV first (psql, from the repository root):
--   \copy catalog.seed_import FROM 'db/seeds/catalogue_v1.csv' WITH (FORMAT csv, HEADER true)
--
-- Enum/derived-value conventions mirror services/commerce/src/catalog/catalogue-mapping.ts:
--   * Fulfilment type: 2 frozen chicken rows are blank -> in_stock (shelf/freezer stock).
--   * Temperature "Ambient or chilled" -> ambient (no enum value for either).
--   * product_compliance.rule_set is the primary rule set for the row.
-- Both defaults are deliberate and reviewed; keep them in step with the mapper.

CREATE TABLE IF NOT EXISTS catalog.seed_import (
  sku text, line text, grp text, product text, variant text, unit text,
  fulfilment text, source text, temperature text, channel text, phase text, rules text
);
TRUNCATE catalog.seed_import;
\copy catalog.seed_import FROM 'db/seeds/catalogue_v1.csv' WITH (FORMAT csv, HEADER true)

BEGIN;

-- 1. Product lines: one per SKU prefix (16).
INSERT INTO catalog.product_lines (code, name, grp, phase)
SELECT DISTINCT ON (split_part(sku, '-', 1) || '-' || split_part(sku, '-', 2))
       split_part(sku, '-', 1) || '-' || split_part(sku, '-', 2) AS code,
       line AS name, grp, phase::smallint
FROM catalog.seed_import
ORDER BY split_part(sku, '-', 1) || '-' || split_part(sku, '-', 2), sku
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, grp = EXCLUDED.grp, phase = EXCLUDED.phase;

-- 2. Products: one per distinct (line, product name) (133).
INSERT INTO catalog.products (line_id, slug, name, halaal_available)
SELECT DISTINCT ON (pl.id, p.product)
       pl.id,
       lower(pl.code) || '-' || trim(both '-' from regexp_replace(lower(p.product), '[^a-z0-9]+', '-', 'g')) AS slug,
       p.product AS name,
       (p.rules ~* 'halaal') AS halaal_available
FROM catalog.seed_import p
JOIN catalog.product_lines pl ON pl.code = split_part(p.sku, '-', 1) || '-' || split_part(p.sku, '-', 2)
ORDER BY pl.id, p.product, p.sku
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, halaal_available = EXCLUDED.halaal_available;

-- 3. Variants: one per SKU (140).
INSERT INTO catalog.variants
  (product_id, sku, pack, unit, fulfilment, temperature, channel, phase, source_kind, weight_g)
SELECT
  pr.id,
  s.sku,
  s.variant,
  s.unit,
  CASE s.fulfilment
    WHEN 'In stock' THEN 'in_stock'
    WHEN 'Pre-order cycle' THEN 'pre_order_cycle'
    WHEN 'Reservation' THEN 'reservation'
    WHEN 'Quote' THEN 'quote'
    WHEN 'Seasonal pre-order' THEN 'seasonal_pre_order'
    ELSE 'in_stock'                       -- blank rows: frozen shelf stock
  END::fulfilment_type,
  CASE s.temperature
    WHEN 'Live' THEN 'live'
    WHEN 'Chilled (0 to 4C)' THEN 'chilled'
    WHEN 'Frozen (-18C)' THEN 'frozen'
    WHEN 'Ambient' THEN 'ambient'
    ELSE 'ambient'                        -- "Ambient or chilled"
  END::temperature_class,
  CASE s.channel
    WHEN 'Both' THEN 'both'
    WHEN 'Public only' THEN 'public_only'
    WHEN 'Trade only' THEN 'trade_only'
  END::channel_type,
  s.phase::smallint,
  s.source,
  (regexp_match(s.variant, '([0-9]+(?:\.[0-9]+)?)(?:\s*(?:to|-)\s*[0-9]+(?:\.[0-9]+)?)?\s*(kg|g)\M'))[1]::numeric
    * CASE WHEN lower((regexp_match(s.variant, '([0-9]+(?:\.[0-9]+)?)(?:\s*(?:to|-)\s*[0-9]+(?:\.[0-9]+)?)?\s*(kg|g)\M'))[2]) = 'kg' THEN 1000 ELSE 1 END
    AS weight_g
FROM catalog.seed_import s
JOIN catalog.product_lines pl ON pl.code = split_part(s.sku, '-', 1) || '-' || split_part(s.sku, '-', 2)
JOIN catalog.products pr
  ON pr.line_id = pl.id
 AND pr.name = s.product
ON CONFLICT (sku) DO UPDATE SET
  product_id = EXCLUDED.product_id, pack = EXCLUDED.pack, unit = EXCLUDED.unit,
  fulfilment = EXCLUDED.fulfilment, temperature = EXCLUDED.temperature, channel = EXCLUDED.channel,
  phase = EXCLUDED.phase, source_kind = EXCLUDED.source_kind, weight_g = EXCLUDED.weight_g;

-- 4. Compliance: one row per variant.
INSERT INTO catalog.product_compliance (variant_id, rule_set, label_text, notes)
SELECT v.id,
  CASE
    WHEN s.rules ~* 'egg|packing station' THEN 'egg_pack_station'
    WHEN s.rules ~* 'poultry abattoir|registered poultry' THEN 'poultry_abattoir'
    WHEN s.rules ~* 'abattoir|meat safety|classified|r55' THEN 'meat_abattoir'
    WHEN s.rules ~* 'co-?pack|processed-meat|nrcs' THEN 'processed_meat_copacker'
    WHEN s.rules ~* 'movement permit|health papers|\mbrand\M|foot-and-mouth|animal diseases' THEN 'animal_health_movement'
    WHEN s.rules ~* 'certificate of acceptability|r638|food safe|food-contact' THEN 'food_premises'
    ELSE 'general'
  END,
  s.rules,
  'Imported from catalogue_v1.csv (T-003)'
FROM catalog.seed_import s
JOIN catalog.variants v ON v.sku = s.sku
ON CONFLICT (variant_id) DO UPDATE SET rule_set = EXCLUDED.rule_set, label_text = EXCLUDED.label_text;

COMMIT;

-- Post-conditions (expect 16 / 133 / 140 / 140).
-- SELECT
--   (SELECT count(*) FROM catalog.product_lines) AS lines,
--   (SELECT count(*) FROM catalog.products) AS products,
--   (SELECT count(*) FROM catalog.variants) AS variants,
--   (SELECT count(*) FROM catalog.product_compliance) AS compliance;
