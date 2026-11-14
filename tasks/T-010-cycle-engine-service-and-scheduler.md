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
- [x] Cycles generated weekly
- [x] Cycle closes at cut-off, creates purchase orders and pick lists
- [x] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
