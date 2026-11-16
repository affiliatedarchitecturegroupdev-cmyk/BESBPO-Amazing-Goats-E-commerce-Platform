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
- [x] Pure rule `nextRunAt(cadence, from)` and `dueSubscriptions(schedules, cycles, at)` for weekly, fortnightly and monthly cadences, aligned to the cut-off engine
- [x] Pause, resume and skip; a skipped run advances the cadence by exactly one period so the schedule is preserved
- [x] Store boundary in place (`SubscriptionStore`); the `sales.subscriptions`, `sales.standing_orders`, `sales.standing_order_lines` SQL adapter lands with T-046
- [x] Routes behind `orders:read` / `orders:write`
- [x] Tests added and passing (25)

## Notes
See `docs/04-cutoff-engine.md` for the cut-off rules. The cycle engine (T-010) is the scheduler to hook into.
Implemented in `subscriptions.types.ts`, `subscriptions.rules.ts`, `subscriptions.store.ts`, `subscriptions.service.ts`, `subscriptions.controller.ts`, `subscriptions.module.ts`. Standing orders recur on a SAST weekday and respect a pause date.
