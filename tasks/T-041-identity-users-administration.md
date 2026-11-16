---
id: T-041
title: Identity: users administration
phase: 4
agent: backend
gate: gate:rbac
files: ["services/identity/src/users/**"]
---
## Goal
Replace the users stub (`users.service.ts` returns `[]`) with user administration.

## Acceptance
- [ ] Pure rule `assertRoleChange(org, change)` enforces separation of duties and never removes the last owner
- [ ] Store over `identity.users`, `identity.user_roles`, `identity.org_members`
- [ ] Routes behind `users:read` / `users:write`; every write audited
- [ ] Tests added and passing

## Notes
See `docs/02-access-control.md`. `gate:rbac` is a review note (the `agent-gate` path list does not include `services/identity/`).
