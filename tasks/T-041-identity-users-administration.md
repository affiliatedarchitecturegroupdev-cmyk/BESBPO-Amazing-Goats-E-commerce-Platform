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
- [x] Pure rule `assertRoleChange(org, change)` enforces separation of duties and never removes the last owner
- [x] Store over `identity.users`, `identity.user_roles`, `identity.org_members`
- [x] Routes behind `users:read` / `users:write`; every write audited
- [x] Tests added and passing

## Notes
See `docs/02-access-control.md`. `gate:rbac` is a review note (the `agent-gate` path list does not include `services/identity/`).

Writes use the RBAC permission `users:manage` (the `@ag/rbac` set defines `users:manage`, not `users:write`).
