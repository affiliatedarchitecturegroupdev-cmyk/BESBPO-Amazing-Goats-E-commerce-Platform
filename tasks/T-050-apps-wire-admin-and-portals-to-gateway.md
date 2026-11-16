---
id: T-050
title: Apps: wire admin, driver, advertiser and partner portals to the gateway
phase: 4
agent: frontend
gate: none
files: ["apps/admin/**", "apps/driver-pwa/**", "apps/advertiser-portal/**", "apps/partner-portal/**", "packages/api-client/**"]
---
## Goal
Replace the local seed data in the admin, driver, advertiser and partner portals with live calls.

## Acceptance
- [x] Each portal reads and writes through `api-client`; mutations carry the caller's bearer token
- [x] The driver app keeps its offline queue: writes enqueue when offline and replay on reconnect
- [x] Seed modules removed or reduced to test fixtures
- [x] Tests added and passing

## Notes
Depends on T-049 for the shared client surface. The driver offline queue is `apps/driver-pwa/lib`; its contract is in `docs/08-offline-driver.md`.
