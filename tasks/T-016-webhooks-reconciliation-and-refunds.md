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
- [ ] Daily settlement matched to bank (`payments.settlements` + `payments.settlement_lines`)
- [ ] Refund needs second approver above limit (`payments.refunds.requested_by` != `approved_by`)
- [ ] Tests added and passing

## Notes
**Re-scoped 2026-11-14.** The webhook delivery half of this task already landed with
T-013 (PR #27), so it is out of scope here:

- Signed webhooks: `providers/webhook-signature.ts` (HMAC over the raw body, constant-time
  compare, replay window) and the `POST /payments/webhooks/:provider` route.
- Event dedup on `(provider, event_id)`, mirroring the unique key on
  `payments.provider_events`, in `webhooks/webhooks.service.ts`.
- Reconciliation/refunds/payouts module skeletons exist but their services are stubs
  (`list()` returns `[]`); the real logic is this task.

**Remaining scope (build on the T-013 provider interface):**

1. **Reconciliation** — match each provider settlement to the bank and to the payments
   it covers, using `payments.settlements` and `payments.settlement_lines`. A settlement
   is `matched` only when the sum of its lines equals `net_cents` and every line resolves
   to a known `payments.payments` row; a mismatch is recorded, not thrown. Pure rule
   beside the service, clock and store injected.
2. **Refunds with a second approver** — a refund above the limit must be approved by a
   different person from the requester. Enforce `approvedBy !== requestedBy` in a pure
   rule (as with pricing four-eyes), keep `refunds:approve` in `TWO_PERSON`, and add a
   test asserting the permission stays there. Below the limit a single approver is fine.
3. **Payouts** — same second-approver rule as refunds (`payments.payouts`).
4. **Chargeback handling** — record a chargeback event and freeze the related payout.

The refund/approval limit is a money rule: keep it a named constant, not a literal.
See `docs/05-payments.md` ("Needs: ... daily settlement reconciliation, refunds with
second approver above a limit, chargeback handling, partner payouts with second approver").
