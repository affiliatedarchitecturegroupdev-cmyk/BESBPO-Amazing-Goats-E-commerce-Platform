-- Reviews (T-070). `sales.reviews` existed since migration 0005 with no code
-- behind it, and as written it enforced neither business rule: any user could
-- insert any rating for any variant, with no purchase and no moderation.
--
-- The two rules are different acts and must not be conflated (ADR 0013 s2):
--
--   Rate   (1-5, no text)  any authenticated customer or trade user
--   Review (text, photo)   a user with a `delivered` order line for that variant
--
-- A rating is an opinion; a review is user-generated advertising under R146 of
-- 2010, which is why text is moderated before it is published and a rating is
-- not. `body IS NULL` is what distinguishes the two in one table.

ALTER TABLE sales.reviews
  ADD COLUMN order_id uuid REFERENCES sales.orders(id) ON DELETE SET NULL,
  ADD COLUMN order_line_id uuid REFERENCES sales.order_lines(id) ON DELETE SET NULL,
  -- Set by the service from the order it verified, never from the request body.
  ADD COLUMN verified_purchase boolean NOT NULL DEFAULT false,
  ADD COLUMN status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'published', 'rejected')),
  ADD COLUMN rejected_reason text,
  ADD COLUMN moderated_by uuid REFERENCES identity.users(id),
  ADD COLUMN moderated_at timestamptz,
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- `approved` was the old flag and is replaced by `status`, which can express
-- "rejected with a reason". Existing rows carry over: an approved row becomes
-- published, anything else pending for a human to look at.
UPDATE sales.reviews SET status = CASE WHEN approved THEN 'published' ELSE 'pending' END;

-- The policy from migration 0011 reads `approved` in its USING expression, so it
-- must go before the column can. It is replaced below by per-command policies:
-- the old one was a single ALL policy, which cannot express "no editing after
-- publish" because it granted UPDATE to the owner as well as SELECT.
DROP POLICY IF EXISTS reviews_owner ON sales.reviews;
ALTER TABLE sales.reviews DROP COLUMN approved;

-- One order yields one review per variant. This is what stops a buyer
-- multiplying the same purchase into five reviews; a rating-only row obeys the
-- same rule, because a second rating for the same order is the same opinion.
-- COALESCE is needed because NULLs do not collide in a unique index, and a
-- rating posted without an order must still be unique per user and variant.
CREATE UNIQUE INDEX reviews_user_variant_order_key
  ON sales.reviews (user_id, variant_id, COALESCE(order_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- The public read is "published reviews for a variant", so that is the index.
CREATE INDEX reviews_variant_published_idx
  ON sales.reviews (variant_id, status) WHERE status = 'published';
CREATE INDEX reviews_status_idx ON sales.reviews (status);

CREATE TRIGGER reviews_updated BEFORE UPDATE ON sales.reviews
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A review is personal data and unmoderated text. Default deny: a customer sees
-- their own rows whatever their status (so they can see a rejection), everyone
-- else sees only `published`. A staff session sees everything, which is what
-- the moderation queue needs.
ALTER TABLE sales.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS reviews_public_read ON sales.reviews;
CREATE POLICY reviews_public_read ON sales.reviews FOR SELECT USING (
  status = 'published'
  OR user_id::text = current_setting('app.user_id', true)
  OR current_setting('app.staff', true) = 'on');

-- A customer writes only a row of their own; `verified_purchase` is not
-- protected by this policy because RLS cannot express "computed by the
-- service", so the service is the guard and this policy stops impersonation.
DROP POLICY IF EXISTS reviews_owner_write ON sales.reviews;
CREATE POLICY reviews_owner_write ON sales.reviews FOR INSERT WITH CHECK (
  user_id::text = current_setting('app.user_id', true)
  OR current_setting('app.staff', true) = 'on');

-- Only the owner may delete, and only their own; moderation is an update by
-- staff. No editing after publish: there is no UPDATE policy for a customer, so
-- a correction is a new row, which is what the card requires.
DROP POLICY IF EXISTS reviews_owner_delete ON sales.reviews;
CREATE POLICY reviews_owner_delete ON sales.reviews FOR DELETE USING (
  user_id::text = current_setting('app.user_id', true)
  OR current_setting('app.staff', true) = 'on');

DROP POLICY IF EXISTS reviews_staff_update ON sales.reviews;
CREATE POLICY reviews_staff_update ON sales.reviews FOR UPDATE USING (
  current_setting('app.staff', true) = 'on')
  WITH CHECK (current_setting('app.staff', true) = 'on');
