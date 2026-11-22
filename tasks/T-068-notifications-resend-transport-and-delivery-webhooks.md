---
id: T-068
title: Notifications: Resend email transport, HTML bodies and delivery webhooks
phase: 6
agent: backend
gate: gate:outbound
files: ["services/notifications/src/**", "packages/api-client/**"]
---
## Goal
Email is the channel that carries `order_confirmation`, and today it has no provider
adapter. `transportsFromEnv` registers an `HttpTransport` only when `EMAIL_API_URL`
and `EMAIL_API_KEY` are set, and the body it POSTs is
`{to, subject, body}` — plain text, no `from`, no HTML. No provider will accept that.

Resend is the chosen provider. It is a body shape and an endpoint
(`POST https://api.resend.com/emails`), not a new architecture: the
`MessageTransport` interface in `services/notifications/src/dispatch/dispatch.ts`
already exists for exactly this (ADR 0008, ADR 0013).

## Acceptance
- [ ] `ResendTransport implements MessageTransport` in `src/channels/`, registered by `transportsFromEnv` when `RESEND_API_KEY` is set; the generic `HttpTransport` stays for any other provider
- [ ] Body built from the rendered template: `{from, to, subject, html, text}`, with `text` always present as the fallback part
- [ ] `EMAIL_FROM_TRANSACTIONAL` and `EMAIL_FROM_MARKETING` are separate identities, so a marketing complaint cannot degrade transactional deliverability (ADR 0013 §3)
- [ ] Templates render HTML as a pure function alongside the existing plain text, so the copy stays testable without sending
- [ ] `POST /notifications/webhooks/resend` verifies the signature and records `email.delivered`, `email.bounced`, `email.complained` against the dispatch log entry by `providerRef`
- [ ] An unverified webhook is rejected with 401 and nothing is written
- [ ] A bounce or complaint marks the address so marketing skips it (`status: bounced` / `complained`); transactional sends continue, because a customer still needs their order confirmation
- [ ] `GET /notifications/email/:id/delivery` returns the delivery state for one message (behind `support:manage`)
- [ ] Tests added and passing, including a recording `fetchFn` — no network in tests

## Notes
Gate is `gate:outbound`: this is the first code that messages real people through a
real provider. Test against a Resend test key and a single allow-listed recipient
before enabling it for any customer.

The dispatch log already records `sent` / `suppressed` / `failed` with a reason. A
webhook turns `sent` into a truthful `delivered` / `bounced`; until it exists, `sent`
means "the provider accepted it", which is not the same thing. Record that distinction
in `docs/16-notifications.md`.

Do not log the provider response body — it can echo the recipient address.
