# Stitch adapter: bank rails behind one interface
Status: accepted

Stitch fronts the South African bank rails. Pay by Bank (Capitec Pay, Absa Pay, PayShap
Request) settles a customer payment straight from a bank account, and Capitec variable
recurring consents collect trade accounts monthly. Both go through the one
`PaymentProvider` interface, so routing, intents and webhooks still never branch on the
provider name.

Two Stitch-specific facts stay inside the adapter. First, its API is GraphQL, so
`createPayment` sends `clientPaymentInitiationRequestCreate` (pay by bank) or
`clientPaymentConsentRequestCreate` (`type: CAPITEC_PAY_RECURRING`, recurring debit) to
`POST https://api.stitch.money/graphql`. Second, Stitch includes *every* payment method
enabled on the client in a request by default, so the adapter sets `paymentMethods`
explicitly — a pay-by-bank request must not silently offer card. The customer is sent to
the Stitch-hosted URL, so this is a redirect provider (`redirectUrl`), not a form POST.

Stitch delivers its webhooks through Svix. The signature is not the `t=...,v1=<hex>` HMAC
the Peach adapter verifies: the signed content is `"<svix-id>.<svix-timestamp>.<rawBody>"`
and the expected value is `base64(HMAC-SHA256(base64(secret), signedContent))`, where the
secret is the base64 part of a `whsec_` value. The `svix-signature` header can list
several `v1,<base64>` entries while a secret rotates, so any match passes; the timestamp
carries the same replay window as the HMAC check. `verifySvixSignature` in
`webhook-signature.ts` owns this, next to the other scheme.

`PaymentInitiationRequestCompleted`/`Cancelled`/`Expired` map onto the neutral
`succeeded`/`cancelled`/`failed`. `refund` calls `refundTransactionInitiate`, idempotent by
the intent's `nonce`, and maps the refund status the same way.
