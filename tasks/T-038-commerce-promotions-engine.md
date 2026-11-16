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
- [x] Pure rule `applyPromotions(cart, promotions, at)` returns per-line and order discounts, honouring stackable vs exclusive flags, minimum spend, date window and per-customer usage caps
- [x] Money stays integer cents; a promotion can never take an order below zero
- [x] Store boundary in place (`PromotionStore`, in-memory default); the `sales.promotions` SQL adapter lands with T-046
- [x] Routes behind `catalog:read` / `catalog:write`; audit on write
- [x] Tests added and passing (28)

## Notes
See `docs/13-pricing.md` and `docs/09-data-model.md` (`sales.promotions`, `sales.gift_cards`). Mirror the pricing module's pure-rule + store pattern. `gate:pricing` is a review note, not an `agent-gate` path.
Implemented in `promotions.types.ts`, `promotions.rules.ts`, `promotions.store.ts`, `promotions.service.ts`, `promotions.controller.ts`, `promotions.module.ts`. Kinds: `percent`, `amount`, `bundle_price`, `free_delivery`.
