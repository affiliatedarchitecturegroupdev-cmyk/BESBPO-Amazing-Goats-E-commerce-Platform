---
id: T-005
title: JWT verification in nest-auth
phase: 0
agent: backend
gate: gate:rbac
files: ["packages/nest-auth/**"]
---
## Goal
JWT verification in nest-auth.

## Acceptance
- [ ] Dev header shim disabled in production
- [ ] Invalid tokens get 401
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
