---
id: T-031
title: Confirm provider fees and settlement terms
phase: 1
agent: human
gate: gate:payments
files: ["services/payments/src/routing/**"]
---
## Goal
Confirm provider fees and settlement terms.

## Acceptance
- [ ] Written quotes recorded
- [x] Fee constants updated
- [x] Tests added and passing

## Notes
Gated (`gate:payments`, `agent: human`): this PR is opened as a **draft** and must not merge
without a written quote per provider and the `human-approved` label.

Fee and settlement constants are now one reviewed schedule each
(`services/payments/src/routing/provider-fees.ts`, `settlement-terms.ts`), and the written
quotes are recorded in `provider-quotes.json` (checked in unconfirmed). `unquotedFeeModels`,
`unconfirmedSettlementTerms` and `quoteDrift` (all tested) list what a human still owes and
flag a signed quote that disagrees with the shipped figure. Record each provider's quote,
flip its `quoted`/`confirmed` flags, then merge.
