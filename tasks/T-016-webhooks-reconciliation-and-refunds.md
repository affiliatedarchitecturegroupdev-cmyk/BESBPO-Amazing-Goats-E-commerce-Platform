---
id: T-016
title: Webhooks, reconciliation and refunds
phase: 1
agent: backend
gate: gate:payments
files: ["services/payments/**"]
---
## Goal
Webhooks, reconciliation and refunds.

## Acceptance
- [ ] Daily settlement matched to bank
- [ ] Refund needs second approver above limit
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
