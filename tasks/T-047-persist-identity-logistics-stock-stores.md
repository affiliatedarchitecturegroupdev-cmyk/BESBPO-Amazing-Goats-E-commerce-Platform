---
id: T-047
title: Persist the identity, logistics and stock stores (SQL adapters)
phase: 4
agent: backend
gate: gate:db
files: ["services/identity/src/**", "services/logistics/src/**", "services/stock/src/**"]
---
## Goal
Swap the in-memory stores in identity, logistics and stock for SQL adapters.

## Acceptance
- [ ] `Pg*Store` over `identity.*`, `logistics.*`, `inventory.*`; modules switch on `STORE_DRIVER`
- [ ] `*.sql-store.integration.spec.ts` per service proving round-trips and RLS scoping
- [ ] Existing suites stay green with and without `DATABASE_URL`
- [ ] Tests added and passing

## Notes
Same pattern as T-046. Keep each service's public service API unchanged so its controllers and specs need no edit.
