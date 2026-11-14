---
id: T-013
title: Payments: provider interface and Peach adapter
phase: 1
agent: backend
gate: gate:payments
files: ["services/payments/**"]
---
## Goal
Payments: provider interface and Peach adapter.

## Acceptance
- [x] Idempotent intents
- [x] Webhook signature verified
- [x] Tests added and passing

## Notes
- One interface (`services/payments/src/providers/provider.interface.ts`) hides every
  provider: `supports`, `createPayment`, `refund`, `verifyWebhook`. `ProvidersService`
  holds the adapters and `providersFromEnv()` registers one only when its credentials
  are present, so a missing provider is skipped by routing, not fatal at start-up.
- Idempotent intents: `createIntent` (pure, tested) returns the stored intent for a
  repeated key and throws when the same key is reused with a different amount. Status
  machine `created → pending → succeeded | failed | cancelled`; terminal states never
  change and a repeat is a no-op, so a resent webhook is harmless.
- Signed webhooks: `verifyHmacSignature` checks `t=<unix>,v1=<hex>` where `v1` is
  `HMAC-SHA256(secret, "<t>.<rawBody>")`, compares in constant time, and rejects a
  timestamp outside a 5-minute window (replay). A bad signature is answered 400 and
  nothing is stored; a verified event is deduplicated on `(provider, event_id)`.
- Peach adapter: bearer-token checkout and refunds, status codes mapped onto the
  neutral vocabulary, webhook signature verified. Reads `PEACH_ENTITY_ID`,
  `PEACH_ACCESS_TOKEN`, `PEACH_WEBHOOK_SECRET`.
- Store is in-memory for now (`InMemoryIntentStore`, `InMemoryWebhookStore`); the SQL
  adapters for `payments.intents` and `payments.provider_events` land with the store
  swap. See `docs/05-payments.md` and ADR `0007`.
