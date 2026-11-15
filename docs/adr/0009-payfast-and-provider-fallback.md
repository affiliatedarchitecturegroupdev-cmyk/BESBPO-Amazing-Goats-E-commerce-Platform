# PayFast adapter and automatic provider fallback

Status: accepted

PayFast is a hosted-page provider: the customer leaves our checkout by a form POST to
PayFast, which then posts an Instant Transaction Notification (ITN) back. Two things
differ from the Peach adapter and both belong inside the adapter, so no other code
branches on the provider name.

First, `createPayment` returns `form: { action, fields }` rather than a `redirectUrl`,
because there is no URL to redirect to — the storefront posts the fields. Second, the
signature is not an HMAC. It is an MD5 over the ordered fields (`payfast-signature.ts`):
every non-blank `name=urlencoded(value)` pair in the order the fields appear in
PayFast's integration, joined with `&`, with the passphrase appended as a final
`passphrase=` pair. Encoding is PHP's `urlencode` (spaces are `+`). The order is the
integration order, not alphabetical — PayFast's separate "API signature" is the
alphabetical scheme, and mixing the two produces a mismatch that is hard to see. An ITN
is form-encoded, so `verifyWebhook` parses the raw body as a form, not JSON.

PayFast has no refund API in the checkout flow, so `refund` records the request as
`pending` for reconciliation rather than reporting success.

For fallback, `withFallback` tries each routed provider in order and returns the first
success. `IntentsService.create` passes it the routed providers that are actually
configured. Each attempt reuses the intent's idempotency key, so a fallback after a
failed primary cannot charge twice. A provider that throws is recorded with its message,
never the raw error object, because a provider error can carry a credential; if every
provider fails the request is answered `503`. A failure after a provider reference was
returned is not retried, because the charge may already exist — only a failure before
that point is safe to fall back from.
