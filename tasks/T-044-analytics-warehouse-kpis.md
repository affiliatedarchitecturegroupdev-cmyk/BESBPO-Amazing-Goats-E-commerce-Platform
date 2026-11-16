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
- [ ] DSO, bad-debt rate and gross-margin queries read from Postgres views over `accounts` and `sales`
- [ ] `/kpis` accepts a date range and returns zeros when there is no data
- [ ] pytest tests added and passing

## Notes
See `docs/03-credit-control.md`. Runs on Koyeb; the pure formulas in `kpis.py` already exist and are tested.
