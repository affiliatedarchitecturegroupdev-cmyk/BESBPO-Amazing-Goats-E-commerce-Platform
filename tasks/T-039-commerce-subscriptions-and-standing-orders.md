---
id: T-039
title: Commerce: subscriptions and standing orders
phase: 4
agent: backend
gate: none
files: ["services/commerce/src/subscriptions/**"]
---
## Goal
Replace the subscriptions stub with recurring order schedules and standing orders.

## Acceptance
- [ ] Pure rule `nextRunAt(schedule, from)` and `dueSubscriptions(schedules, at)` for weekly, fortnightly and monthly cadences, aligned to the cut-off engine
- [ ] Pause, resume and skip; a skipped run advances the cadence but never past the next cut-off
- [ ] Store over `sales.subscriptions`, `sales.standing_orders`, `sales.standing_order_lines`
- [ ] Routes behind `catalog:read` / `catalog:write`
- [ ] Tests added and passing

## Notes
See `docs/04-cutoff-engine.md` for the cut-off rules. The cycle engine (T-010) is the scheduler to hook into.
