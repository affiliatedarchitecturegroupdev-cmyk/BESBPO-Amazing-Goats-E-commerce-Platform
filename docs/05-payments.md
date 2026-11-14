# Payments orchestration
One payment service hides providers. Routing and fee model: `services/payments/src/routing/route-payment.ts` (tested).

| Method | Order tried | Notes |
|---|---|---|
| Pay by bank | Stitch, Peach, PayFast | Capitec Pay, PayShap Request, Instant EFT. Show first, offer about 1% discount. |
| Card | Peach, PayFast, Stitch | Hosted fields only (PCI scope minimal), 3D Secure |
| Wallet, BNPL | PayFast, Peach | Payflex, Float, MoreTyme, Mobicred |
| Recurring debit | Stitch | Trade collections |
| Escrow | TradeSafe | From R10,000 (minimum fee); farm-gate purchases |
| Trade terms | LulaPay | Pilot, behind a feature flag |
| Point of sale | Yoco | Farm shop |

Published fees (excluding VAT, November 2026, to be confirmed in writing): PayFast card 3.2% + R2, Instant EFT 2% (min R2); Peach about 2.95% + R1.50 cards, 1.5% + R1.50 pay by bank; Stitch 2.95% cards. On a R3,105 box: card R92 to R101, pay by bank about R47 to R62. Needs: idempotency keys, signed webhooks, daily settlement reconciliation, refunds with second approver above a limit, chargeback handling, partner payouts with second approver, accounting sync.

## Provider interface
Every adapter implements one interface (`services/payments/src/providers/provider.interface.ts`),
so routing, intents and webhooks never branch on the provider name:

- `supports(method)` — whether the provider can settle a method.
- `createPayment(request)` — returns a `providerRef` and where to send the customer.
- `refund(request)` — idempotent by `idempotencyKey`.
- `verifyWebhook(input)` — verifies the signature over the raw body and normalises the event, or throws.

`ProvidersService` holds the adapters and answers `list()`/`get(id)`. `providersFromEnv()`
registers an adapter only when its credentials are present, so a missing provider is
skipped by routing instead of failing every request at start-up.

## Idempotent intents
An intent (`payments.intents`) is created from an idempotency key
(`services/payments/src/providers/payment-intent.ts`, tested). The same key returns
the stored intent, so a retried request or a double-click creates one intent and at
most one charge. A key reused with a different amount throws, because returning the
first intent would hide a real mismatch. The status machine is
`created → pending → succeeded | failed | cancelled`; a terminal status never changes,
and a repeat of the current status is a no-op, so a provider that resends a webhook is
harmless.

`POST /payments/intents` (behind `orders:write`) creates and charges; `GET /payments/intents`
and `GET /payments/intents/:id` (behind `payments:read`) read them.

## Signed webhooks
`POST /payments/webhooks/:provider` is unauthenticated by the RBAC guard because the
provider authenticates with its signature, which the adapter verifies over the exact
bytes received. `verifyHmacSignature` checks a `t=<unix>,v1=<hex>` header where `v1`
is `HMAC-SHA256(secret, "<t>.<rawBody>")`, compares in constant time, and rejects a
timestamp outside the tolerance window (default 5 minutes) so a captured body cannot
be replayed. `verifyHmacBody` covers providers that sign the body directly. A bad
signature is answered 400 and nothing is stored.

A verified event is deduplicated on `(provider, event_id)` (mirroring the unique key on
`payments.provider_events`) and applied to the matching intent. An out-of-order or
illegal transition is ignored rather than retried, so the provider is not asked to
resend. `GET /payments/webhooks` (behind `payments:read`) lists received events.

## Peach adapter
`services/payments/src/providers/peach.provider.ts` maps Peach onto the interface: a
bearer-token checkout (`POST /v2/checkout`) and refunds, its status codes onto
`succeeded`/`failed`/`cancelled`/`pending`, and its webhook signature. It reads
`PEACH_ENTITY_ID`, `PEACH_ACCESS_TOKEN` and `PEACH_WEBHOOK_SECRET`. The store is
in-memory for now (`InMemoryIntentStore`, `InMemoryWebhookStore`); the SQL adapters for
`payments.intents` and `payments.provider_events` land with the store swap.
