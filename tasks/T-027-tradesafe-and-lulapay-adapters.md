---
id: T-027
title: TradeSafe and LulaPay adapters
phase: 2
agent: backend
gate: gate:payments
files: ["services/payments/**"]
---
## Goal
TradeSafe and LulaPay adapters.

## Acceptance
- [x] Escrow only from R10,000
- [x] LulaPay behind a feature flag
- [x] Tests added and passing

## Notes
See docs/05-payments.md. TradeSafe (escrow, from R10,000) and LulaPay (trade BNPL, pilot) implement the one PaymentProvider interface in services/payments/src/providers, registered by providersFromEnv behind their credentials and the LULAPAY_ENABLED flag.
