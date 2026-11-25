---
id: T-077
title: Storefront: remaining public pages (delivery, produce, track, FAQ, 404)
phase: 6
agent: frontend
gate: none
files: ["apps/storefront/**"]
---
## Goal
Four public routes are stubs that render `TODO(agent): build this screen from
wireframe`, and they are in the sitemap, so they are indexable placeholder pages:
`/delivery` (`sf-delivery`), `/produce` (`sf-produce`), `/track/[orderId]` (`sf-track`).
`/recipes` is T-072.

A competitive food platform also needs a few pages that were never in the wireframes:
an FAQ (which the assistant and `FAQPage` markup both feed on), and a 404 that helps
rather than dead-ends.

## Acceptance
- [x] `/delivery` (`sf-delivery`): zones, slots, cut-off times, fees, cold-chain explanation, and the link to the area checker (T-078)
      — already built by T-055/T-078; verified rendering
- [x] `/produce` (`sf-produce`): the produce range with fulfilment tags, reading the catalogue like `/shop/[category]`
      — already built by T-055; verified rendering
- [ ] `/track/[orderId]` (`sf-track`): order status timeline from the order events, requiring a session and the caller's own order; no order id enumeration
- [x] `/faq`: grouped questions (delivery, payment, returns, halaal, storage) from a data file, ready for `FAQPage` markup (T-073)
      (`lib/faq.ts`, `app/faq/page.tsx`; 14 questions, `FAQPage` JSON-LD, answers restate `@ag/policy` and link to it)
- [x] `not-found.tsx` gains a search box and category links, so a 404 is a route back into the shop
      (plain GET form to `/search`, all 7 category links; verified 404 returns HTTP 404)
- [ ] All four stub `TODO(agent)` comments removed; `/delivery` and `/produce` stay in `STATIC_ROUTES`
      — `/delivery` and `/produce` were already built (no TODO) and stay in `STATIC_ROUTES`; `/faq` added.
      **`/track/[orderId]` still carries its TODO** — blocked on a backend route, see below.
- [x] `/track/` stays in `PRIVATE_PATHS` and is `noindex`
- [ ] Tests added and passing: each page renders, track refuses another user's order, 404 offers search
      — FAQ 11 tests, plus render verification of `/faq`, `/delivery`, `/produce` and the 404.
      **The track-ownership test is not written**: it is blocked with the page (see below).

## Notes
No gate. Respect the fulfilment tags and RBAC as the existing category pages do.

`/track` carries an order id, so it is personal data: keep it out of the index and out
of the sitemap, and check ownership server-side before rendering anything.

## Blocker: `/track/[orderId]` cannot be built from the storefront

The card requires tracking to "requir[e] a session and the caller's own order; no
order id enumeration". That is a backend fact, not a screen: the storefront can only
show what the gateway will authorise.

- `commerce/orders/:id` is guarded by `@RequirePermissions('orders:read')`, and
  `orders:read` is held only by staff roles (`ops_manager`, `sales`, `dispatch`,
  `support`, …). A customer holds no order-read permission at all.
- There is no customer-scoped route (`/commerce/orders/mine` or similar) and no
  endpoint that returns `sales.order_events` rows.
- `sales.order_events` exists with owner RLS, so the data model is ready; the
  service route is not.

Building the page against `commerce/orders/:id` would mean either granting customers
`orders:read` — which would let any customer enumerate every order — or leaving a
stub that pretends to check ownership. Both are worse than leaving the card open.

**Needed to finish:** a `GET /commerce/orders/:id/tracking` (or `/mine`) in
`services/commerce` that scopes to the session's own order and returns the event
timeline. That is `services/commerce/**` work, outside this card's `apps/storefront/**`
scope, so it needs its own card.

`/track/[orderId]` therefore keeps its `TODO(agent)` stub, stays `noindex` and in
`PRIVATE_PATHS`, and is not linked from anywhere.
