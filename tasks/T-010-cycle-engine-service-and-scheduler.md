---
id: T-010
title: Cycle engine service and scheduler
phase: 1
agent: backend
gate: none
files: ["services/commerce/src/cycles/**"]
---
## Goal
Cycle engine service and scheduler.

## Acceptance
- [ ] Cycles generated weekly
- [ ] Cycle closes at cut-off, creates purchase orders and pick lists
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
