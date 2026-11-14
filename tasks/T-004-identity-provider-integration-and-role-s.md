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
- [ ] Login with MFA works in dev
- [ ] Role to permission mapping synced to the database
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
