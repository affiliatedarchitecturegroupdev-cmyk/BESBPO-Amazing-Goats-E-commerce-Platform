# Credit control
Tiers (see `services/accounts/src/credit-limits/tiering.ts`):

| Tier | Terms | Limit | Moves up when |
|---|---|---|---|
| New | Prepay | none | 3 completed prepaid orders, documents and bureau check pass |
| Probation | 7 days | about 1 week of spend | 3 clean months, on-time rate 95% or better |
| Standard | 14 days | about 2 weeks | 6 clean months, on-time rate 98% or better |
| Preferred | 30 days | up to 4 weeks | n/a |

Drops: 14+ days late drops one tier; 30+ days returns to prepay; high bureau risk means prepay only. **NCA caution:** sole proprietors and entities below R1,000,000 turnover may fall inside the National Credit Act, so they are capped at probation until legal sign-off, and no penalty interest is charged in the first agreements (FIC Act question). The system proposes; a person approves; two approvers above the threshold.

Approval: `services/accounts/src/credit-limits/credit-approval.rules.ts` holds the workflow as pure functions. `evaluateTier` flags a limit above the approval threshold (`CREDIT_APPROVAL_THRESHOLD_CENTS`, R100,000) with `needsApproval`; the same threshold is where `needsSecondApprover` turns true, so a large limit needs two distinct approvers, neither the proposer nor each other. Nothing is in force until approved: the limit row carries `status` (`proposed`, `approved`, `rejected`).

Collections: reminder 3 days before due, due notice, +1 reminder, +7 call, +14 hold (standing orders paused), +30 demand. The schedule and the ageing buckets are pure functions in `services/accounts/src/collections/dunning.rules.ts`; statements are built from open invoices by `services/accounts/src/statements/statement.rules.ts`. 24 hour dispute window with photo and temperature evidence. Bureau: pbVerify or XDS plus CIPC and director check at onboarding, Experian BusinessIQ later. LulaPay pilot for longer terms in Phase 2.
