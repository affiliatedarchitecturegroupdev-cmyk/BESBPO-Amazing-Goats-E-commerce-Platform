---
id: T-066
title: Driver PWA: IndexedDB offline queue and day-close
phase: 5
agent: frontend
gate: none
files: ["apps/driver-pwa/**"]
---
## Goal
The offline queue is a `TODO(T-021)` stub: `apps/driver-pwa/lib/offline-queue.ts`
keeps events in memory only, so a driver who closes the tab in a low-signal area
loses the day's captures. `docs/08-offline-driver.md` calls for a durable queue.

## Acceptance
- [ ] The queue is backed by IndexedDB (`idb`), so queued events survive a reload and a closed tab
- [ ] Events are encrypted at rest with a key the app derives per install
- [ ] The queue clears after the day closes and after a confirmed sync
- [ ] `replayQueue` drains in order and the sync route reports accepted and duplicate counts (already implemented)
- [ ] A test drives queue → reload → drain against fake IndexedDB
- [ ] Tests added and passing

## Notes
See `docs/08-offline-driver.md`. `apps/driver-pwa/lib/sync.ts` already models the
drain; only the storage layer is missing. The `TODO(T-021)` sits at
`offline-queue.ts:36`.
