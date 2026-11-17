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
- [ ] `/account` shows orders, subscriptions and invoices for the signed-in shopper
- [ ] `/trade` routes a business to the application and the trade portal
- [ ] `api-client` gains the reads these pages need (order by id, subscriptions, invoices)
- [ ] Tests added and passing

## Notes
`docs/wireframes/index.html#sf-track`, `#sf-account`, `#sf-trade-entry`. A8 (the
thank-you offer) is served on the tracking screen. Account reads need the
caller's bearer token; keep it server-side (`docs/01-architecture.md`).
