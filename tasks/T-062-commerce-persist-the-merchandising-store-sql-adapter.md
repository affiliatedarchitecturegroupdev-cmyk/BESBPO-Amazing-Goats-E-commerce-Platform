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
- [x] A `merchandising.sql-store.ts` behind the existing store interface, selected by `selectStore`/`STORE_DRIVER` like `catalog.sql-store.ts`
- [x] A migration adds the section-to-variant bridge and RLS (staff-write, public-read) — over the `catalog.merch_sections`/`merch_items` tables 0003 already created (see Notes)
- [x] Sections and items round-trip: create, reorder, publish and read back a page
- [x] The in-memory store stays the default, so existing tests are unchanged
- [x] A `describe.skipIf(!admin)` integration spec runs the store against Postgres and cleans its own rows
- [x] Tests added and passing

## Notes
Gate is `gate:db` (a migration). Follow `catalog.sql-store.ts` and the RLS
conventions in `db/conventions`. The resolved read was gated by
`merch:manage`, which no storefront caller holds; while here, added a public
read route the BFF can use so it stops relying on the catch-and-fallback in
`services/gateway/src/bff/bff.service.ts`.

The card named `commerce.merchandising_sections`/`_items`. There is no `commerce`
schema (0001 creates the ten per-context schemas) and the whole repository — the
data-model doc, the domain types and the store comment — points at
`catalog.merch_sections`/`merch_items`, which 0003 created for exactly this
purpose. Migration 0018 lands over those rather than duplicating them: it adds the
`external_id` bridge (the section's opaque string id over the serial integer key)
and the row-level security the tables never had. Editorial content is public to
read (the live, in-window sections) and staff-only to write, so an anonymous
storefront read sees live strips and never a draft or an expired one; the policy's
window matches the domain's `isSectionVisible`, which the service re-applies.

The app role needs `USAGE, SELECT` on sequences now that a serial-keyed table is
insertable (`db/README.md`, `db/tests/rls.sql`).
