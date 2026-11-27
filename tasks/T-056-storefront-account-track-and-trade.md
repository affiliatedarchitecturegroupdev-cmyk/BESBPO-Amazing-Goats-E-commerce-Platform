---
id: T-056
title: Storefront: account, tracking and trade entry
phase: 4
agent: frontend
gate: none
files: ["apps/storefront/**", "packages/api-client/**"]
---
## Goal
The post-purchase and trade-entry screens are `TODO(agent)` stubs: `sf-track`
(live status, driver ETA, temperature, A8), `sf-account` (reorder,
subscriptions, addresses, invoices, loyalty), and `sf-trade-entry` (apply or log
in to the trade portal).

## Acceptance
- [ ] `/track/[orderId]` shows the order status and the delivery progress from the logistics service
      — status and a derived four-step progress are done; the driver ETA, live
temperature and the A8 offer from logistics are **not** wired (see Progress)
- [ ] `/account` shows orders, subscriptions and invoices for the signed-in shopper
      — orders and subscriptions are done; invoices are not (see Progress)
- [x] `/trade` routes a business to the application and the trade portal
- [x] `api-client` gains the reads these pages need (`myOrders`, `myOrder`)
- [x] Tests added and passing

## Progress
- [x] **Tracking (this change).** `/track` lists the shopper's own orders,
      `/track/[orderId]` shows one, and `/track/latest` redirects to the newest.
      The `TODO(agent)` stub is gone.
- [x] The read is `GET /commerce/my-orders` and `GET /commerce/my-orders/:id`,
      behind `@RequireAuthenticated` rather than `orders:read`: a customer does
      not hold a staff permission and must not gain one to track a parcel.
- [x] Ownership is decided in commerce from the request session
      (`sales.orders.customer_user_id`), never from a request field. A caller who
      does not own an order gets the same 404 as one asking for an order that
      does not exist, so ids cannot be probed.
- [x] `Order` now carries `customerUserId` for that check; `toPublicOrder`
      strips it, so it cannot reach the storefront.
- [ ] Still open: the logistics read. The page shows the order's own status and a
      four-step progress derived from it (`apps/storefront/lib/track.ts`). A live
      driver ETA and the cold-chain temperature exist in `services/logistics`, but
      they are keyed by delivery run, not by order id, so joining them needs a
      logistics read this card did not include. The page does not invent an ETA.
- [ ] Still open: the A8 thank-you offer on the delivered state.
- [x] **Subscriptions (this change).** `/account` now lists the shopper's
      recurring orders with the cadence, the next run in South African time, and
      a pause/resume control. The reads are `GET /commerce/my-subscriptions` and
      `GET /commerce/my-subscriptions/:id`, and the writes are
      `POST .../:id/pause` and `POST .../:id/resume`, all behind
      `@RequireAuthenticated` for the same reason tracking is: a customer holds
      `customer:own`, not a staff permission.
- [x] Ownership is decided in commerce from the session
      (`sales.subscriptions.customer_user_id`) and again in
      `subscription-access.ts` before projection. A caller who does not own a
      subscription gets the same 404 as one asking for an id that does not
      exist, so ids cannot be probed.
- [x] Pausing is not skipping: `nextRunAt` is kept and shown, so a resumed
      subscription does not silently move to a different day.
- [ ] `/account` still needs invoices, which need a commerce read this card does
      not cover.

## Notes
`docs/wireframes/index.html#sf-track`, `#sf-account`, `#sf-trade-entry`. A8 (the
thank-you offer) is served on the tracking screen. Account reads need the
caller's bearer token; keep it server-side (`docs/01-architecture.md`).
