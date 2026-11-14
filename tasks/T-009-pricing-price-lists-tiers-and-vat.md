---
id: T-009
title: Pricing: price lists, tiers and VAT
phase: 1
agent: backend
gate: gate:pricing
files: ["services/commerce/src/pricing/**"]
---
## Goal
Pricing: price lists, tiers and VAT.

## Acceptance
- [x] Public, trader, trade and bakery lists
- [x] Two-person approval on publish
- [x] Tests added and passing

## Notes
- Audiences are `public`, `trader`, `trade_a`, `trade_b`, `bakery` (matching `catalog.price_lists.audience`); a list is created as a draft, submitted, then published by a second person.
- Two-person approval is enforced in the pure rule `publish`: it throws when `approvedBy === requestedBy`. `pricing:approve` is already in the RBAC `TWO_PERSON` list, and a test asserts the two stay aligned.
- VAT: `vatBreakdown` gives `{ exVatCents, vatCents, incVatCents }`; `addVat`/`removeVat` take an optional rate so zero-rated goods price at 0%. 15% remains the default.
- Only one list per audience is live: publishing supersedes the previous one, and `activeListFor` picks the latest `validFrom` among live lists. The window is half-open `[validFrom, validTo)`.
- `resolvePrice` returns `null` (not a guess) when no live list prices a SKU, so callers can fall back to the public list.
- Store is in-memory for now (`InMemoryPricingStore`); the SQL adapter for `catalog.price_lists` lands with the store swap. See `docs/13-pricing.md`.
