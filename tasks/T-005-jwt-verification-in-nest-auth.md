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
- [x] Dev header shim disabled in production
- [x] Invalid tokens get 401
- [x] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
