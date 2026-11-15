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
`PEACH_ENTITY_ID`, `PEACH_ACCESS_TOKEN` and `PEACH_WEBHOOK_SECRET`. The store is in-memory
by default (`InMemoryIntentStore`, `InMemoryWebhookStore`); with `STORE_DRIVER=sql` the
SQL adapters over `payments.intents` and `payments.provider_events` are used (see
"Persistence" below).

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

## Stitch adapter
`services/payments/src/providers/stitch.provider.ts` maps Stitch onto the interface.
Stitch fronts the bank rails — Pay by Bank (Capitec Pay, Absa Pay, PayShap Request) for
pay by bank, and Capitec variable-recurring consents for trade collections. It is a
hosted **redirect** provider, so `createPayment` returns the Stitch-hosted `redirectUrl`.
It reads `STITCH_CLIENT_ID`, `STITCH_CLIENT_SECRET` and `STITCH_WEBHOOK_SECRET`.

Its API is **GraphQL** (`POST https://api.stitch.money/graphql`), so the adapter sends a
`clientPaymentInitiationRequestCreate` mutation for pay by bank and a
`clientPaymentConsentRequestCreate` mutation (`type: CAPITEC_PAY_RECURRING`) for a
recurring debit. Because Stitch includes *every* method enabled on the client by default,
the request sets `paymentMethods` explicitly, so a pay-by-bank request cannot silently
offer card. Its webhooks are delivered through **Svix**, so `verifyWebhook` checks the
`svix-id`/`svix-timestamp`/`svix-signature` headers with `verifySvixSignature`
(`webhook-signature.ts`, tested): the signed content is `"<id>.<timestamp>.<rawBody>"` and
the expected value is `base64(HMAC-SHA256(base64(secret), signedContent))`, any entry in a
space-delimited `v1,<base64>` list passing, with the same replay window as the HMAC check.
`PaymentInitiationRequestCompleted`/`Cancelled`/`Expired` map onto
`succeeded`/`cancelled`/`failed`. `refund` calls `refundTransactionInitiate`, idempotent by
the intent's `nonce`.

## TradeSafe escrow adapter

`services/payments/src/providers/tradesafe.provider.ts` maps TradeSafe onto the interface.
TradeSafe holds a buyer's funds until both parties accept the delivery, which is what a
farm-gate purchase needs. Escrow carries a minimum fee, so it is offered only from R10,000
(`ESCROW_MINIMUM_CENTS`); routing refuses a smaller amount, and the adapter refuses again in
`createPayment` as a second line of defence. It is a hosted **redirect** provider, so
`createPayment` returns the TradeSafe-hosted `redirectUrl`. It reads `TRADESAFE_CLIENT_ID`,
`TRADESAFE_CLIENT_SECRET` and `TRADESAFE_WEBHOOK_SECRET`. Its webhooks use the same
`t=<unix>,v1=<hex>` HMAC scheme as Peach (`verifyHmacSignature`), and
`FUNDS_RECEIVED`/`FUNDS_RELEASED`/`CANCELLED`/`FAILED`/`EXPIRED` map onto
`succeeded`/`cancelled`/`failed`.

## LulaPay adapter (pilot)

`services/payments/src/providers/lulapay.provider.ts` maps LulaPay onto the interface.
LulaPay is a trade BNPL provider: the merchant is paid now and the trade buyer settles over
longer terms, so it settles the `trade_bnpl` method. It is a Phase 2 pilot behind a feature
flag: `providersFromEnv` registers it only when `LULAPAY_ENABLED=true`, and `createPayment`
refuses while `enabled` is false, so a stray route cannot reach the pilot while it is off
(`feature-flags.ts`, tested). It is a hosted **redirect** provider and reads `LULAPAY_API_KEY`,
`LULAPAY_WEBHOOK_SECRET` and `LULAPAY_ENABLED`. Its webhooks sign the body directly, so
`verifyWebhook` uses `verifyHmacBody` and deduplicates by event id (there is no timestamp
envelope). `APPROVED`/`SETTLED`/`DECLINED`/`EXPIRED`/`CANCELLED` map onto
`succeeded`/`failed`/`cancelled`.

## Settlement reconciliation

Each provider settlement (`payments.settlements`) is matched to the payments it covers
(`payments.settlement_lines`) by one pure rule,
`reconcileSettlement` (`services/payments/src/reconciliation/reconciliation.rules.ts`,
tested). A settlement reconciles only when every line resolves to a known payment **and**
the lines sum exactly to `net_cents`. A mismatch is recorded as a reason
(`no_lines`, `lines_do_not_sum_to_net`, `unknown_payment`), never thrown: reconciliation is
a nightly batch, and one bad settlement must not stop the rest. `ReconciliationService`
runs one settlement (`POST /payments/reconciliation/:id/reconcile`) or the whole period
(`POST /payments/reconciliation/run`), and `GET /payments/reconciliation/exceptions` lists
what did not reconcile. `markMatched` records the outcome so a re-run is stable.

## Refunds, payouts and chargebacks (money out, four-eyes)

Money leaving the platform goes through one set of rules,
`services/payments/src/money/money.rules.ts` (tested). A refund or payout **above** its
limit must be approved by a person other than the requester; at or below the limit a single
approver is enough. The limits are named constants —
`REFUND_SECOND_APPROVER_LIMIT_CENTS` (R5,000) and `PAYOUT_SECOND_APPROVER_LIMIT_CENTS`
(R25,000) — not literals, and `assertSecondApprover` throws rather than returning a flag, so
a caller cannot forget to check it. This mirrors the pricing four-eyes rule
(`publish` in `services/commerce/src/pricing/pricing.rules.ts`); the same guarantee holds
whatever the transport, and `refunds:approve`/`payouts:approve` stay in `TWO_PERSON`
(`packages/rbac`).

- Refunds (`payments.refunds`): `request` records who asked, `approve` enforces four-eyes,
  `markRefunded` pays out. `POST /payments/refunds`, `POST /payments/refunds/:id/approve`.
- Payouts (`payments.payouts`): the same flow, plus `freeze` for a chargeback.
- Chargebacks: `ChargebacksService.receive` records the event and **freezes the related
  payout** so the money is held before it leaves. A payout that is already `paid` cannot be
  clawed back, so freezing is a no-op on it.

The stores are in-memory by default (`InMemoryRefundsStore`, `InMemoryPayoutsStore`,
`InMemoryReconciliationStore`, `InMemoryChargebacksStore`); with `STORE_DRIVER=sql` the
SQL adapters over `payments.refunds`, `payments.payouts`, `payments.settlements`/
`payments.settlement_lines` and `payments.chargebacks` are used (see "Persistence" below).

## Persistence

Each service keeps its business rules as pure functions and puts storage behind a store
interface with an in-memory default. `STORE_DRIVER=memory` (the default) keeps tests and
local runs database-free; `STORE_DRIVER=sql` selects the SQL adapters, which require
`DATABASE_URL` and connect through `@ag/db`.

`@ag/db` owns the one thing every adapter must get right: the row-level-security session.
`Db.withSession(context, fn)` opens a transaction, applies `app.org_id`, `app.user_id` and
`app.staff` with a parameterised `set_config(..., true)` (transaction-local, so the values
cannot be injected and reset with the transaction), runs `fn`, then commits or rolls back.
The application connects as a `NOSUPERUSER, NOBYPASSRLS` role (see `db/README.md`); a
superuser or table owner would bypass the policies silently, which the `@ag/db`
integration test guards against by asserting scoping through such a role.

