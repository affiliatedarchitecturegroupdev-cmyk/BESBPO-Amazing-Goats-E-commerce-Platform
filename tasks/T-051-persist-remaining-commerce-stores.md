---
id: T-051
title: Persist the remaining commerce stores (SQL adapters)
phase: 4
agent: backend
gate: gate:db
files: ["services/commerce/src/**", "db/migrations/**"]
---
## Goal
Finish the commerce store swap so a `STORE_DRIVER=sql` deployment persists the
whole service, not just catalog, pricing, cycles and orders. Promotions,
subscriptions and standing orders, merchandising, product compliance and supplier
onboarding still run on hardcoded in-memory stores, which the ADR
(`docs/adr/0012-persistence-and-store-swap.md`) forbids: "One switch for the whole
service, so a deployment cannot end up with half its stores persisted."

## Acceptance
- [x] `Pg*Store` for promotions, subscriptions/standing orders, merchandising,
  product compliance and supplier onboarding over `sales.*`, `catalog.*` and
  `partners.*`; every module uses `selectStore(inMemory, () => new Pg*Store(db))`
- [x] `PgReviewStore` over `sales.reviews` and `PgReviewAudit` over
  `audit.audit_log`, so moderation decisions survive a restart too
- [x] Migration `0018_commerce_store_completion.sql` (additive columns, the one
  missing table, and the RLS the new tables need)
- [x] The commerce integration spec covers each new adapter (round-trip + RLS)
- [x] `pnpm --filter @ag/commerce test` green with and without `DATABASE_URL`
- [x] Tests added and passing

## Notes
Mirror `services/commerce/src/orders/orders.sql-store.ts` and T-046. The domain
keys on opaque string ids while the schema keys on uuids, so the adapters carry
the domain id in an `external_id`/`*_ref` column, the same bridge T-046..T-048 use.
Merchandising items and standing-order lines are edited wholesale, so they are
stored as a `jsonb` payload on the parent row (the `sales.pick_lists` precedent).
A `store-driver.spec.ts` guard fails if a commerce module ever news up an
in-memory store outside `selectStore`, so the service cannot drift back to half
persisted. Reviews was the last module the guard caught: `sales.reviews` and its
RLS existed since migration 0022 but nothing selected a SQL adapter, and the
moderation trail lived only in process memory.
