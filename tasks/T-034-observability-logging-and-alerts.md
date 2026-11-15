---
id: T-034
title: Observability, logging and alerts
phase: 1
agent: devops
gate: gate:infra
files: ["infra/**"]
---
## Goal
Observability, logging and alerts.

## Acceptance
- [x] Health checks on all services
- [x] Alert on temperature breach
- [x] Tests added and passing

## Notes
Delivered in PR #26 as `@ag/observability` plus `GET /health` on every deployable and
cold-chain alerts. See `docs/15-observability.md` and ADR `0006`.
