---
id: T-015
title: Stitch adapter: pay by bank and recurring debits
phase: 1
agent: backend
gate: gate:payments
files: ["services/payments/**"]
---
## Goal
Stitch adapter: pay by bank and recurring debits.

## Acceptance
- [x] Pay-by-bank first in checkout
- [x] Recurring collection for trade accounts
- [x] Tests added and passing

## Notes
- **Stitch adapter** (`services/payments/src/providers/stitch.provider.ts`): a hosted
  **redirect** provider, so `createPayment` returns the Stitch-hosted `redirectUrl`.
  Reads `STITCH_CLIENT_ID`, `STITCH_CLIENT_SECRET`, `STITCH_WEBHOOK_SECRET`; registered by
  `providersFromEnv()` only when its credentials are present. `supports()` covers
  `pay_by_bank`, `card` and `recurring_debit`.
- **GraphQL API**: `POST https://api.stitch.money/graphql`. Pay by bank uses
  `clientPaymentInitiationRequestCreate`; a recurring debit uses
  `clientPaymentConsentRequestCreate` (`type: CAPITEC_PAY_RECURRING`, monthly). Because
  Stitch offers every client-enabled method by default, the request sets `paymentMethods`
  explicitly so a pay-by-bank request cannot silently offer card.
- **Pay-by-bank first**: routing already puts Stitch first for `pay_by_bank`
  (`route-payment.ts`), and `ProvidersService` now registers the adapter, so pay by bank
  is the primary provider for that method in checkout.
- **Webhooks** are delivered through Svix; `verifySvixSignature` (`webhook-signature.ts`,
  pure + tested) checks `svix-id`/`svix-timestamp`/`svix-signature` over
  `"<id>.<timestamp>.<rawBody>"` with `base64(HMAC-SHA256(base64(secret), signedContent))`,
  any entry in the space-delimited list passing, with a replay window.
  `PaymentInitiationRequestCompleted`/`Cancelled`/`Expired` → `succeeded`/`cancelled`/`failed`.
- **Refunds**: `refundTransactionInitiate`, idempotent by the intent's `nonce`.
- Docs: `docs/05-payments.md`, ADR `0010`, AGENTS.md learnings.
