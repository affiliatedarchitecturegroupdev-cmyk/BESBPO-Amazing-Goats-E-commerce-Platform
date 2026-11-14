---
id: T-006
title: Persist audit log
phase: 0
agent: backend
gate: gate:db
files: ["packages/nest-auth/**", "services/identity/**"]
---
## Goal
Persist audit log.

## Acceptance
- [x] Every mutating request writes an audit row
- [x] Audit rows cannot be updated
- [x] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
