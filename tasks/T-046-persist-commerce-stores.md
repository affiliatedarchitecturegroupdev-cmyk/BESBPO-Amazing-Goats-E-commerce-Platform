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
- [ ] `Pg*Store` for catalog, cycles, orders, pricing over `catalog.*` and `sales.*`; modules use `selectStore(inMemory, () => new Pg*Store(db))`
- [ ] One `*.sql-store.integration.spec.ts` proving round-trips against live Postgres and RLS scoping
- [ ] `pnpm --filter @ag/commerce test` green with and without `DATABASE_URL`
- [ ] Tests added and passing

## Notes
Mirror `services/payments/src/intents/intents.sql-store.ts` and `intents.module.ts`. `gate:db` is a review note; migrations are already present, so no `db/migrations/` change is expected.
