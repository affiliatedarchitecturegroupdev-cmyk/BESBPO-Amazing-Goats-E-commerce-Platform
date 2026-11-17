---
id: T-053
title: Storefront: make the cart real (add, update, remove, checkout)
phase: 4
agent: frontend
gate: none
files: ["apps/storefront/**"]
---
## Goal
The cart is a fixture. "Add to cart" is a `<Link href="/cart">`, the `ag_cart`
cookie is never written, and `parseCart` falls back to `FIXTURE_CART_LINES`, so
every shopper sees the same two demo lines and checkout never reflects what they
picked. Make the cart hold what the shopper chose.

## Acceptance
- [x] Pure cart edits (`addLine`, `setLineQty`, `removeLine`) with tests
- [x] Server actions write the `ag_cart` cookie; no fixture fallback remains
- [x] Product and category tiles add to the cart; the cart page updates and removes lines
- [x] An empty cart renders an empty state and checkout refuses an empty cart
- [x] Tests added and passing

## Notes
Prices are read server-side from the catalogue in the add action, so a tampered
form cannot set the price of a line. The line carries the fulfilment type and
temperature the cart groups by (`docs/wireframes/index.html#sf-cart`).

A gateway-owned cart session (shared with the trade portal) is a later step; the
storefront owns the cookie for now. See `docs/01-architecture.md` (gateway BFF).
