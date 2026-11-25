# Ratings and reviews

`sales.reviews` has existed since migration 0005 with no code behind it. As
written it enforced neither business rule: any user could insert any rating for
any variant, with no purchase and no moderation. The code is
`services/commerce/src/reviews`; the migration is `0022_reviews_verified_purchase.sql`.

## Two different acts

These are not the same thing, and conflating them is the bug the card exists to
prevent (ADR 0013 §2):

| Act | Who | Enforced by |
| --- | --- | --- |
| **Rate** — 1–5, no text | any authenticated customer or trade user | role check in `mayRate` |
| **Review** — text and/or photo | a user with a `delivered` order line for that variant | `deliveredPurchaseFor` against `sales.order_lines` + order status |

A rating is an opinion. A review is user-generated advertising under R146 of
2010, which is why text is moderated before publication and a bare rating is not.
`body IS NULL` distinguishes them in one table.

`submissionKind` is the single place the distinction is drawn — text **or** a
photo makes it a review — so the two rules cannot drift apart.

## `verified_purchase` is never taken from the request

The service loads the caller's order lines and sets `verified_purchase`,
`order_id` and `order_line_id` itself. A caller claiming a purchase in the
request body is ignored, and a review whose order does not belong to the caller
cannot be created because the only orders considered are the ones the store read
for that user.

A **shipped** order is not enough. Only `delivered` counts: before delivery the
person has not received the product and has nothing to review.

## One opinion per order

```
UNIQUE (user_id, variant_id, COALESCE(order_id, '000…0'::uuid))
```

The `COALESCE` matters because NULLs do not collide in a unique index, so without
it a bare rating could be posted repeatedly. A repeat buyer may review again on a
later order; the same buyer cannot multiply one purchase into five reviews.

## Ratings and reviews are counted separately

```
ratingCount   40     ← how many people scored the product
reviewCount    2     ← how many wrote something
averageRating  4.6
verifiedCount 31
```

A single `reviewCount` of 40 would be misleading — that is the shape this
aggregate exists to avoid.

## Moderation

Reviews enter `pending`. Only `published` rows are public or appear in
structured data. `POST /commerce/reviews/:id/moderate` is behind
`reviews:moderate` and takes `publish` or `reject`.

A rejection **must** carry a reason: the author is entitled to know why their
writing is not shown (CPA s11 plain language), and a silent rejection is
indistinguishable from a bug. The reason is stored on the row for the author and
the decision is appended to the audit log **before** it takes effect, so a
failure cannot publish without a trace.

## No editing after publish

A customer may delete their own row; there is no customer `UPDATE` policy. A
correction is a new row, so published history cannot be rewritten after the fact.

## Row-level security

| Session | Sees |
| --- | --- |
| anonymous / other user | `published` only |
| author | own rows in any status, so a rejection is visible to them |
| staff | everything (the moderation queue) |

Verified against a `NOSUPERUSER` role: anonymous saw 1 published row, a second
user saw the published row plus their own pending row, the author saw their own.

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /commerce/reviews?variantId=` | public | published rows + aggregate |
| `POST /commerce/reviews` | authenticated | rate, or review with a delivered purchase |
| `DELETE /commerce/reviews/:id` | authenticated | owner or staff |
| `POST /commerce/reviews/:id/moderate` | `reviews:moderate` | publish or reject with a reason |

A refusal is `403` with a plain reason (`a written review needs a delivered order
for this product`), not a bare "forbidden", so the person learns what would let
them write it.

## Not in this card

Photo **upload**. `photo_url` accepts a URL only; there is no object store wired
up, and inventing a storage service here would be out of scope. The stores are
in-memory behind the interfaces a SQL adapter implements, as with the other
commerce modules.
