# One provider interface, idempotent intents, signed webhooks
Status: accepted

Every payment provider is hidden behind one interface
(`services/payments/src/providers/provider.interface.ts`): `supports`, `createPayment`,
`refund` and `verifyWebhook`. Routing (`routePayment`) picks the order; the adapter owns
the provider's request shape, its status vocabulary and its signature scheme, so no
other code branches on the provider name. Adding PayFast or Stitch is a new adapter,
not a change to intents or webhooks.

An intent is created from an idempotency key and the same key returns the stored
intent, so a retried request or a double-click creates one intent and at most one
charge. A key reused with a different amount throws rather than silently returning the
first intent, because that would hide a real mismatch. The status machine is
`created → pending → succeeded | failed | cancelled`, terminal states never change, and
a repeat of the current status is a no-op, so a resent webhook is harmless.

Webhooks are verified over the raw body with an HMAC and a timestamp inside a short
tolerance window, compared in constant time. A bad or replayed signature is answered
400 and nothing is stored. A verified event is deduplicated on `(provider, event_id)`
(the unique key on `payments.provider_events`) and applied to the matching intent; an
out-of-order transition is ignored rather than retried.

The alternative — trusting the provider's dashboard, or reconciling only daily — was
rejected: a double charge or a forged callback is a money bug, and the rules belong in
one tested place. The store is in-memory for now; the SQL adapters for
`payments.intents` and `payments.provider_events` swap the store, not the rules.
