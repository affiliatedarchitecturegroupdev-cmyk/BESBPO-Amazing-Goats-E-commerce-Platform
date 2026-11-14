---
id: T-023
title: Admin: roles and access management
phase: 1
agent: frontend
gate: gate:rbac
files: ["apps/admin/**", "services/identity/**"]
---
## Goal
Admin: roles and access management.

## Acceptance
- [x] Role changes need a second approver
- [x] Break-glass elevation recorded
- [x] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
