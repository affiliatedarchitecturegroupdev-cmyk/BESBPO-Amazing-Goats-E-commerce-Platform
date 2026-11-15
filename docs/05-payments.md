# Payments orchestration

One payment service hides providers. Routing and fee model: `services/payments/src/routing/route-payment.ts` (tested).

| Method          | Order tried            | Notes                                                                           |
| --------------- | ---------------------- | ------------------------------------------------------------------------------- |
| Pay by bank     | Stitch, Peach, PayFast | Capitec Pay, PayShap Request, Instant EFT. Show first, offer about 1% discount. |
| Card            | Peach, PayFast, Stitch | Hosted fields only (PCI scope minimal), 3D Secure                               |
| Wallet, BNPL    | PayFast, Peach         | Payflex, Float, MoreTyme, Mobicred                                              |
| Recurring debit | Stitch                 | Trade collections                                                               |
| Escrow          | TradeSafe              | From R10,000 (minimum fee); farm-gate purchases                                 |
| Trade terms     | LulaPay                | Pilot, behind a feature flag                                                    |
| Point of sale   | Yoco                   | Farm shop                                                                       |

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

## PayFast adapter

`services/payments/src/providers/payfast.provider.ts` maps PayFast onto the interface.
PayFast is a hosted-page provider: the customer is sent to it by a form POST, not a
redirect, so `createPayment` returns `form: { action, fields }` (signed) instead of a
`redirectUrl`. It reads `PAYFAST_MERCHANT_ID`, `PAYFAST_MERCHANT_KEY` and
`PAYFAST_PASSPHRASE`.

PayFast's signature is not the HMAC the other adapters use. It is an **MD5 over the
ordered fields** (`payfast-signature.ts`, tested): every non-blank `name=urlencoded(value)`
pair in the order the fields appear in PayFast's integration, joined with `&`, with the
passphrase appended as a final `passphrase=` pair. Encoding is PHP's `urlencode`, so a
space is `+`. The order is the integration order, not alphabetical (PayFast's separate
"API signature" is the alphabetical one — do not mix them). An ITN is form-encoded, so
`verifyWebhook` parses the raw body as a form and checks the `signature` field over the
other fields; `payment_status` of `COMPLETE`/`CANCELLED`/`FAILED` maps onto
`succeeded`/`cancelled`/`failed`. PayFast has no refund API in the checkout flow, so
`refund` records the request as `pending` for reconciliation rather than claiming it is
done.

## Automatic fallback

`withFallback` (`services/payments/src/routing/provider-fallback.ts`, tested) tries each
routed provider in order and returns the first success. `IntentsService.create` passes it
the routed providers that are actually configured, so if the primary fails (a timeout, a
5xx) the next provider is tried automatically. Each attempt carries the same idempotency
key, so a fallback cannot charge twice. A provider that throws is recorded with its
message — never the raw error object, which could carry a credential — and if every
provider fails the request is answered `503`. A failure that happened _after_ a provider
reference was returned is not retried, because the charge may already exist.
