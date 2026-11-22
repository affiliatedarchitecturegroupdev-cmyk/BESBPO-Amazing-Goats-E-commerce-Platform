---
id: T-079
title: Commerce: wishlist, back-in-stock alerts and abandoned-cart recovery
phase: 6
agent: backend
gate: gate:outbound
files: ["services/commerce/src/**", "services/notifications/src/**", "db/migrations/**"]
---
## Goal
Three retention mechanics that turn a first order into a habit, all of which the
platform lacks:

- **Wishlist** — save a product for later. No table, no UI.
- **Back-in-stock alerts** — a chilled product is pre-ordered by cut-off cycle and
  frequently unavailable; a customer who wants it has no way to be told.
- **Abandoned-cart recovery** — a cart that is not checked out is a sale that nearly
  happened. There is no recovery email.

Two of these send marketing-adjacent email, which is why the card is gated.

## Acceptance
- [ ] Migration adds `sales.wishlists (user_id, variant_id, created_at)` with a unique pair
- [ ] Migration adds `sales.stock_alerts (user_id, variant_id, created_at, notified_at)` with a unique pair, so one customer is told once per restock
- [ ] `POST/DELETE /commerce/wishlist/:variantId`, `GET /commerce/wishlist` — behind the customer's own session
- [ ] `POST /commerce/stock-alerts/:variantId` — subscribe to a restock notification
- [ ] A restock event marks matching alerts and queues a notification; sending goes through `decideConsent` and the existing dispatch log
- [ ] Abandoned-cart recovery: a cart untouched for a configurable window triggers one email, and only one, carrying the cart contents and the cut-off deadline
- [ ] Recovery email is suppressed when the customer has already ordered since, or has not consented to marketing — a transactional cart reminder to an existing shopper is still a marketing message under POPIA
- [ ] Recovery respects the cut-off: never remind a customer about a cycle that has closed
- [ ] Every send is recorded in the dispatch log with a reason, as existing sends are
- [ ] Tests added and passing: unique pairs, one-notification rule, consent suppression, cut-off suppression, no duplicate recovery

## Notes
Gate is `gate:outbound`: this sends marketing-adjacent email to real people. Depends on
T-068 for the transport and T-069 for the consent model.

The "only one reminder" rule matters more than the reminder. Repeated recovery email is
the fastest way to lose a customer and damage the sending domain.
