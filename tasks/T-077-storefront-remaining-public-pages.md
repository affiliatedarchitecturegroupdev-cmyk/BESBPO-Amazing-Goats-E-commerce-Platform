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
- [ ] `/delivery` (`sf-delivery`): zones, slots, cut-off times, fees, cold-chain explanation, and the link to the area checker (T-078)
- [ ] `/produce` (`sf-produce`): the produce range with fulfilment tags, reading the catalogue like `/shop/[category]`
- [ ] `/track/[orderId]` (`sf-track`): order status timeline from the order events, requiring a session and the caller's own order; no order id enumeration
- [ ] `/faq`: grouped questions (delivery, payment, returns, halaal, storage) from a data file, ready for `FAQPage` markup (T-073)
- [ ] `not-found.tsx` gains a search box and category links, so a 404 is a route back into the shop
- [ ] All four stub `TODO(agent)` comments removed; `/delivery` and `/produce` stay in `STATIC_ROUTES`
- [ ] `/track/` stays in `PRIVATE_PATHS` and is `noindex`
- [ ] Tests added and passing: each page renders, track refuses another user's order, 404 offers search

## Notes
No gate. Respect the fulfilment tags and RBAC as the existing category pages do.

`/track` carries an order id, so it is personal data: keep it out of the index and out
of the sitemap, and check ownership server-side before rendering anything.
