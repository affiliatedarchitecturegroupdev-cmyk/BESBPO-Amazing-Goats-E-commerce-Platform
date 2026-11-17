---
id: T-046
title: Persist the commerce stores (SQL adapters)
phase: 4
agent: backend
gate: gate:db
files: ["services/commerce/src/**"]
---
## Goal
Swap the in-memory commerce stores for SQL adapters, following the T-037 pattern.

## Acceptance
- [x] `Pg*Store` for catalog, cycles, orders, pricing over `catalog.*` and `sales.*`; modules use `selectStore(inMemory, () => new Pg*Store(db))`
- [x] One `*.sql-store.integration.spec.ts` proving round-trips against live Postgres and RLS scoping
- [x] `pnpm --filter @ag/commerce test` green with and without `DATABASE_URL`
- [x] Tests added and passing

## Notes
Mirror `services/payments/src/intents/intents.sql-store.ts` and `intents.module.ts`. `gate:db` is a review note.

The schema did need additions after all (`db/migrations/0015_commerce_persistence.sql`):
the price-list workflow columns (`status`, `requested_by`, `published_at`), the
`external_id`/`code` bridges for the string domain ids (`catalog.price_lists`,
`sales.orders`, `sales.cycles`), and the two derived cycle outputs
(`sales.pick_lists`, `sales.cycle_purchase_orders`). The domain uses opaque string
ids while the schema keys on uuids, so the adapters carry the domain id in a unique
column and resolve it to the uuid where a foreign key is needed.
