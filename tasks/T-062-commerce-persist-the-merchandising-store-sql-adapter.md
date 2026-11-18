---
id: T-062
title: Commerce: persist the merchandising store (SQL adapter)
phase: 5
agent: backend
gate: gate:db
files: ["services/commerce/src/merchandising/**", "db/migrations/**"]
---
## Goal
Unlike catalog, the merchandising store is in-memory only. Curated sections do
not persist under `STORE_DRIVER=sql`, so the storefront's curated sections
(T-054) vanish on restart. Found during T-054.

## Acceptance
- [ ] A `merchandising.sql-store.ts` behind the existing store interface, selected by `selectStore`/`STORE_DRIVER` like `catalog.sql-store.ts`
- [ ] A migration adds `commerce.merchandising_sections` and `commerce.merchandising_items` with a section-to-variant bridge and RLS scoped to staff
- [ ] Sections and items round-trip: create, reorder, publish and read back a page
- [ ] The in-memory store stays the default, so existing tests are unchanged
- [ ] A `describe.skipIf(!admin)` integration spec runs the store against Postgres and cleans its own rows
- [ ] Tests added and passing

## Notes
Gate is `gate:db` (a migration). Follow `catalog.sql-store.ts` and the RLS
conventions in `db/conventions`. The resolved read is currently gated by
`merch:manage`, which no storefront caller holds; while here, add a public
read route the BFF can use so it stops relying on the catch-and-fallback in
`services/gateway/src/bff/bff.service.ts`.
