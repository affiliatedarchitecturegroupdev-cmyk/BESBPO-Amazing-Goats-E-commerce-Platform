---
id: T-038
title: Commerce: promotions engine and store
phase: 4
agent: backend
gate: gate:pricing
files: ["services/commerce/src/promotions/**"]
---
## Goal
Replace the promotions stub (`promotions.service.ts` returns `[]`) with a tested discount engine and store.

## Acceptance
- [ ] Pure rule `applyPromotions(cart, promotions, at)` returns per-line and order discounts, honouring stackable vs exclusive flags, minimum spend, date window and per-customer usage caps
- [ ] Money stays integer cents; a promotion can never take an order below zero
- [ ] Store over `sales.promotions` behind the store boundary (in-memory default, `PgPromotionStore` under `STORE_DRIVER=sql`)
- [ ] Routes behind `catalog:read` / `catalog:write`; audit on write
- [ ] Tests added and passing

## Notes
See `docs/13-pricing.md` and `docs/09-data-model.md` (`sales.promotions`, `sales.gift_cards`). Mirror the pricing module's pure-rule + store pattern. `gate:pricing` is a review note, not an `agent-gate` path.
