-- Staging import of the approved catalogue (140 products). TODO(T-003): map into catalog.products and catalog.variants.
CREATE TABLE IF NOT EXISTS catalog.seed_import (sku text, line text, grp text, product text, variant text, unit text, fulfilment text, source text, temperature text, channel text, phase text, rules text);
TRUNCATE catalog.seed_import;
\copy catalog.seed_import FROM 'db/seeds/catalogue_v1.csv' WITH (FORMAT csv, HEADER true)
