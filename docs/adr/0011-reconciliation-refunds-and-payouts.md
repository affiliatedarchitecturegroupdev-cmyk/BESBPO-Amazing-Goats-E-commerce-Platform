# Reconciliation, refunds, payouts and chargebacks

Status: accepted

Money out is a different risk from money in, so the reconciliation, refund, payout and
chargeback modules are now real. All of them are pure rules beside a thin service, with the
clock and the store injected, so they are unit-tested without a database.

**Reconciliation.** `reconcileSettlement` matches one provider settlement to the payments
it covers. It reconciles only when every line resolves to a known payment and the lines sum
exactly to `net_cents`; otherwise it returns a reason (`no_lines`,
`lines_do_not_sum_to_net`, `unknown_payment`). A mismatch is recorded, not thrown, because
this runs as a nightly batch over every settlement and one bad row must not abort the run.
`ReconciliationService.runAll` records each outcome through `markMatched`, so a re-run is
stable and `GET .../exceptions` is the operator's work queue.

**Second approver above a limit.** A refund or payout above its limit must be approved by
someone other than the requester. This is the same four-eyes rule the pricing module uses
(`publish`), lifted into one place, `money.rules.ts`:

- `REFUND_SECOND_APPROVER_LIMIT_CENTS` (R5,000) and `PAYOUT_SECOND_APPROVER_LIMIT_CENTS`
  (R25,000) are named constants, not literals, because a money threshold is a policy the
  business will change and a reviewer must be able to find it.
- `assertSecondApprover` throws rather than returning a boolean, so a caller cannot forget
  to check the result — the same reasoning as enforcing four-eyes in the domain rather than
  only in the RBAC guard.
- `refunds:approve` and `payouts:approve` stay in `TWO_PERSON` (`packages/rbac`), and a test
  asserts that, so the permission and the rule cannot drift apart.

Below the limit a single approver is fine, so ordinary support refunds are not slowed down.

**Chargebacks.** `ChargebacksService.receive` records the event and freezes the related
payout, so the money is held before it leaves. Freezing a payout that is already `paid` is a
no-op: the money has gone, and pretending otherwise would hide the loss.

The stores are in-memory until the SQL adapters land with the store swap, exactly as the
intent and webhook stores are today.
