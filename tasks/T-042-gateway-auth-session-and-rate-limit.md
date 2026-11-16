---
id: T-042
title: Gateway: auth session and rate limiting
phase: 4
agent: backend
gate: gate:rbac
files: ["services/gateway/src/auth/**", "services/gateway/src/rate-limit/**"]
---
## Goal
Replace the gateway `auth` and `rate-limit` stubs with a session endpoint and a token-bucket limiter.

## Acceptance
- [x] `GET /gateway/auth/me` returns the resolved user and roles; `GET /gateway/auth/session` returns expiry
- [x] Pure rule `rateLimitDecision(bucket, now, limit, burst)`; a limited call returns 429 with `Retry-After`
- [x] Per-route limits configured, keyed by user then IP
- [x] Tests added and passing

## Notes
See `docs/01-architecture.md`. The guard already resolves the caller (`userFromRequest`); this exposes it and bounds traffic.
