---
id: T-044
title: Analytics: warehouse-backed KPIs
phase: 4
agent: backend
gate: none
files: ["services/analytics/**"]
---
## Goal
Read KPIs from the warehouse instead of query parameters (`app/main.py` `# TODO(agent)`).

## Acceptance
- [x] DSO, bad-debt rate and gross-margin queries read from Postgres views over `accounts` and `sales`
- [x] `/kpis` accepts a date range and returns zeros when there is no data
- [x] pytest tests added and passing

## Notes
See `docs/03-credit-control.md`. Runs on Koyeb; the pure formulas in `kpis.py` already exist and are tested.

The read model lives in `services/analytics/app/warehouse.py` as the KPI queries over `accounts` and `sales` (the analytics service owns its own read model on its Koyeb database). The platform `db/migrations/**` path is gated, and this task is `gate: none`, so the queries are not a migration; this matches the SQL-adapter pattern the payments and accounts services use.
