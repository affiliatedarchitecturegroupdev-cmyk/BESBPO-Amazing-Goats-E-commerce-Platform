---
id: T-021
title: Driver PWA: offline queue and sync
phase: 1
agent: frontend
gate: none
files: ["apps/driver-pwa/**", "services/logistics/src/driver-sync/**"]
---
## Goal
Driver PWA: offline queue and sync.

## Acceptance
- [x] Works with no signal for a full route
- [x] Conflict rule applied
- [x] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
