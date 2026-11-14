---
id: T-004
title: Identity provider integration and role sync
phase: 0
agent: backend
gate: gate:rbac
files: ["services/identity/**", "packages/rbac/**"]
---
## Goal
Identity provider integration and role sync.

## Acceptance
- [x] Login with MFA works in dev
- [x] Role to permission mapping synced to the database
- [x] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
