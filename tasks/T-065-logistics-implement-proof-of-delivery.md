---
id: T-065
title: Logistics: implement proof of delivery (read, capture, temperature)
phase: 5
agent: backend
gate: none
files: ["services/logistics/src/proof-of-delivery/**"]
---
## Goal
Proof of delivery is a stub: `ProofOfDeliveryService.list()` returns `[]` with a
`TODO(agent)`, and its spec asserts the empty result. The driver PWA captures
proof and temperature on the stop screen (`dr-proof`), but the service never
stores or serves it.

## Acceptance
- [ ] A `ProofOfDeliveryStore` boundary with an in-memory default and a SQL adapter (`logistics.proof_of_delivery`, RLS scoped to the owning org and staff)
- [ ] `list()` reads real records; `capture(stopId, { signature, photoRef, temperatureC, capturedAt })` stores one and is idempotent per stop
- [ ] A pure rule rejects a capture outside the cold-chain band and flags a temperature excursion
- [ ] Routes stay behind `RequirePermissions('delivery:execute')`; a customer may read their own delivery's proof
- [ ] The driver PWA's sync (`apps/driver-pwa/app/api/sync`) posts the capture it already queues
- [ ] Tests added and passing

## Notes
See `docs/08-offline-driver.md` and wireframe `dr-proof`. The driver PWA already
holds the queue and the proof view-model (`apps/driver-pwa/lib/proof.ts`), so the
gap is the service behind them. Coordinates with T-066.
