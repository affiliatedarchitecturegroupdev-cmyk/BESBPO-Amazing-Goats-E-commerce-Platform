---
id: T-070
title: Commerce: ratings and reviews with verified-purchase rules and moderation
phase: 6
agent: backend
gate: gate:db
files: ["services/commerce/src/**", "db/migrations/**", "packages/api-client/**"]
---
## Goal
`sales.reviews` exists in migration 0005 and has no code behind it. As written the
table enforces neither business rule:

```sql
CREATE TABLE sales.reviews (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id uuid REFERENCES catalog.variants(id), user_id uuid REFERENCES identity.users(id),
  rating smallint CHECK (rating BETWEEN 1 AND 5), body text, photo_url text,
  approved boolean NOT NULL DEFAULT false);
```

Any user can insert any rating for any variant with no purchase. The two rules the
business requires are different acts and must not be conflated (ADR 0013 §2):

| Act | Who | Enforced by |
| --- | --- | --- |
| Rate (1–5, no text) | Any authenticated customer or trade user | role check |
| Review (text, photo) | A user with a `delivered` order line for that variant | query against `sales.order_lines` + order status |

## Acceptance
- [ ] Migration extends `sales.reviews`: `order_id`, `order_line_id`, `verified_purchase boolean NOT NULL DEFAULT false`, `status` in `pending|published|rejected` (replacing `approved`), `rejected_reason`, `moderated_by`, `moderated_at`, timestamps
- [ ] Unique `(user_id, variant_id, order_id)` so one order yields one review; a rating-only row uses the same table with `body` null
- [ ] `verified_purchase` is set by the service from the order, never from the request body; a review whose `order_id` does not belong to the caller is rejected
- [ ] A review with text requires a delivered order line containing that variant; a rating without text requires only an authenticated customer or trade role
- [ ] `POST /commerce/reviews` — create (rating, or review with text/photo); returns 403 with a plain reason when the caller has not purchased
- [ ] `DELETE /commerce/reviews/:id` — a customer may delete their own review; no editing after publish, a correction is a new row
- [ ] `GET /commerce/reviews?variantId=` — published reviews plus the aggregate
- [ ] Aggregate reports ratings and reviews separately (`ratingCount`, `reviewCount`, `averageRating`), so 40 ratings and 2 reviews do not imply 40 written reviews
- [ ] `POST /commerce/reviews/:id/moderate` (behind `reviews:moderate`) publishes or rejects with a reason; every decision is audited
- [ ] Reviews enter `pending`; only `published` rows appear publicly or in structured data
- [ ] RLS: a customer reads only their own non-published rows; public reads see `published` only
- [ ] Tests added and passing: unregistered user refused, registered non-purchaser may rate but not review, purchaser may review, duplicate refused, moderation audited

## Notes
Gate is `gate:db` (new migration) and touches RBAC (a new `reviews:moderate`
permission). Text reviews are user-generated advertising under R146 of 2010, which is
why publication is moderated rather than automatic.

Photo upload is referenced by the existing `photo_url` column; if no object store is
configured, accept a URL only and leave upload to a later card. Do not invent a storage
service here.
