---
id: T-014
title: PayFast adapter and automatic fallback
phase: 1
agent: backend
gate: gate:payments
files: ["services/payments/**"]
---
## Goal
PayFast adapter and automatic fallback.

## Acceptance
- [x] Fallback when primary fails
- [x] Tests added and passing

## Notes
- **PayFast adapter** (`services/payments/src/providers/payfast.provider.ts`): a hosted-page
  provider, so `createPayment` returns `form: { action, fields }` (signed) instead of a
  `redirectUrl`. Reads `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY`, `PAYFAST_PASSPHRASE`.
  Registered by `providersFromEnv()` only when its credentials are present.
- **Signature** (`payfast-signature.ts`, pure + tested): MD5 over the ordered fields —
  every non-blank `name=urlencoded(value)` pair in PayFast's integration order, joined with
  `&`, plus a final `passphrase=` pair. Encoding is PHP `urlencode` (space is `+`). The ITN
  is form-encoded, so `verifyWebhook` parses the raw body as a form and checks the
  `signature` field over the others. `COMPLETE`/`CANCELLED`/`FAILED` → `succeeded`/`cancelled`/`failed`.
  PayFast has no checkout refund API, so `refund` records `pending` for reconciliation.
- **Automatic fallback** (`routing/provider-fallback.ts`, pure + tested): `withFallback`
  tries the routed, configured providers in order and returns the first success. `IntentsService.create`
  uses it, reusing the same idempotency key per attempt so a fallback cannot double charge;
  a provider error is recorded as its message (never the raw error), and an all-failed
  request is answered `503`.
- `PaymentResult` gained an optional `form` field for hosted-page providers.
- Docs: `docs/05-payments.md`, ADR `0009`, AGENTS.md learnings.
