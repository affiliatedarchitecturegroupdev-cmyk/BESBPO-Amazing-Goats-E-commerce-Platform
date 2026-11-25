-- Content model (T-071). A food platform in KwaZulu-Natal competes on questions
-- with purchase intent behind them: "where to buy lamb in Durban", "how to cook
-- goat curry". There was no content capability at all - no table, no route.
--
-- Content is also the substrate the assistant (T-074) retrieves from. Grounded
-- only in product rows it can answer "what is in the lamb box" and nothing else.
--
-- One model serves blog posts, recipes and buying guides (ADR 0013 s1) because
-- they share a shape and all link to products; `kind` separates them.

CREATE TABLE catalog.content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('post', 'recipe', 'guide')),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  -- Markdown, not HTML: diffable, safe after sanitising, writable by a
  -- non-technical author. Rendered once by a tested pure function.
  body_md text NOT NULL DEFAULT '',
  author_user_id uuid REFERENCES identity.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'review', 'published', 'archived')),
  published_at timestamptz,
  hero_image_url text,
  seo_title text,
  seo_description text,
  taxonomy text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- A post is "about" products, and those links are what let a buying guide put
-- the right variant in front of the reader.
CREATE TABLE catalog.content_products (
  content_id uuid NOT NULL REFERENCES catalog.content(id) ON DELETE CASCADE,
  variant_id uuid NOT NULL REFERENCES catalog.variants(id) ON DELETE CASCADE,
  PRIMARY KEY (content_id, variant_id)
);

-- The public list is "published items of a kind, optionally by taxonomy".
CREATE INDEX content_kind_published_idx ON catalog.content (kind, published_at DESC)
  WHERE status = 'published';
CREATE INDEX content_taxonomy_idx ON catalog.content USING gin (taxonomy);
CREATE INDEX content_products_variant_idx ON catalog.content_products (variant_id);

CREATE TRIGGER content_updated BEFORE UPDATE ON catalog.content
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Drafts are not public. Default deny: only `published` rows are readable
-- without a staff session, which is what keeps a half-written post off the
-- storefront and out of the assistant's retrieval set.
ALTER TABLE catalog.content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_public_read ON catalog.content;
CREATE POLICY content_public_read ON catalog.content FOR SELECT USING (
  status = 'published'
  OR current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS content_staff_write ON catalog.content;
CREATE POLICY content_staff_write ON catalog.content FOR INSERT WITH CHECK (
  current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS content_staff_update ON catalog.content;
CREATE POLICY content_staff_update ON catalog.content FOR UPDATE USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');

-- The join table is readable when its parent is; a draft's products must not
-- leak through the link table.
ALTER TABLE catalog.content_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_products_read ON catalog.content_products;
CREATE POLICY content_products_read ON catalog.content_products FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM catalog.content c
    WHERE c.id = content_id
      AND (c.status = 'published' OR current_setting('app.staff', true) = 'on')
  ));

DROP POLICY IF EXISTS content_products_staff_write ON catalog.content_products;
CREATE POLICY content_products_staff_write ON catalog.content_products FOR ALL USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');
