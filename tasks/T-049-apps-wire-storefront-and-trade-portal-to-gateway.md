---
id: T-049
title: Apps: wire storefront and trade portal to the gateway
phase: 4
agent: frontend
gate: none
files: ["apps/storefront/**", "apps/trade-portal/**", "packages/api-client/**"]
---
## Goal
Replace the local seed data in the storefront and trade portal with live calls through `packages/api-client`.

## Acceptance
- [ ] `api-client` gains the endpoints these pages need (catalogue, cycle, cart, checkout) with typed responses
- [ ] Pages fetch from the gateway base URL; loading and error states handled; no server secret in the browser bundle
- [ ] `lib/*-seed.ts` modules removed or reduced to test fixtures
- [ ] Tests added and passing

## Notes
See `docs/01-architecture.md` (gateway BFF) and `docs/12-file-structure.md`. This is the join between the UI scaffold and the services.
