---
id: T-048
title: Persist the ads, partners and notifications stores (SQL adapters)
phase: 4
agent: backend
gate: gate:db
files: ["services/ads/src/**", "services/partners/src/**", "services/notifications/src/**"]
---
## Goal
Swap the in-memory stores in ads, partners and notifications for SQL adapters.

## Acceptance
- [x] `Pg*Store` over `ads.*`, `partners.*` and the notification dispatch/consent tables
- [x] `*.sql-store.integration.spec.ts` per service proving round-trips and RLS scoping
- [x] Existing suites stay green with and without `DATABASE_URL`
- [x] Tests added and passing

## Notes
Same pattern as T-046. Notifications keep the pure template renderer; only the store changes.
