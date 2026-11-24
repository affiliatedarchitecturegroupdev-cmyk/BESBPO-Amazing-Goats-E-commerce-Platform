-- Recipe detail (T-072). T-071 gave content a `recipe` kind, but a recipe is not
-- only prose: a shopper standing at a stove wants the ingredient list, the steps
-- and how long it takes, and the storefront cannot reconstruct those from a
-- Markdown body without guessing at the author's formatting.
--
-- Why the detail is a separate table rather than columns on `catalog.content`:
-- only a recipe has servings, times and an ingredient list, and a post with three
-- always-NULL columns invites a later reader to wonder whether a guide was
-- supposed to have them. One-to-one, keyed on the content row, so a recipe is
-- still one content item with one slug, one publish workflow and one set of links.
--
-- Ingredient quantities are free text in `jsonb` on purpose. "2 kg lamb shoulder"
-- is a cooking instruction, not a catalogue line: forcing it into the variant
-- model would mean inventing a product for "salt", and would break the moment a
-- recipe says "a handful of parsley". The structured fields are what the page
-- renders; the prose stays prose.

CREATE TABLE catalog.content_recipes (
  -- One recipe per content row, and deleting the content deletes the detail.
  content_id uuid PRIMARY KEY REFERENCES catalog.content(id) ON DELETE CASCADE,
  servings int NOT NULL CHECK (servings > 0),
  prep_minutes int NOT NULL DEFAULT 0 CHECK (prep_minutes >= 0),
  cook_minutes int NOT NULL DEFAULT 0 CHECK (cook_minutes >= 0),
  -- `[{ "quantity": "2 kg", "item": "lamb shoulder", "note": "bone in" }]`.
  -- Validated as an array at write time so the renderer can rely on the shape.
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(ingredients) = 'array'),
  -- `[{ "text": "Brown the shoulder in a heavy pot." }]`, in order. The array
  -- order is the step order: a `step_no` column would let two steps claim the
  -- same number and leave the page with no defined sequence.
  steps jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(steps) = 'array'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER content_recipes_updated BEFORE UPDATE ON catalog.content_recipes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Recipes are read with their parent, so the parent's index already serves the
-- join. This index is for the reverse: "which recipes use this ingredient" once
-- the assistant (T-074) starts retrieving by ingredient.
CREATE INDEX content_recipes_ingredients_idx
  ON catalog.content_recipes USING gin (ingredients);

-- A recipe's detail must not be more visible than the recipe itself: a draft
-- recipe's ingredient list is unpublished copy, and the assistant's retrieval
-- set must not reach it. The policy mirrors `catalog.content` exactly.
ALTER TABLE catalog.content_recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS content_recipes_read ON catalog.content_recipes;
CREATE POLICY content_recipes_read ON catalog.content_recipes FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM catalog.content c
    WHERE c.id = content_id
      AND (c.status = 'published' OR current_setting('app.staff', true) = 'on')
  ));

DROP POLICY IF EXISTS content_recipes_staff_write ON catalog.content_recipes;
CREATE POLICY content_recipes_staff_write ON catalog.content_recipes FOR ALL USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');
