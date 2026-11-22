# Notifications

Customer messages go out over email, WhatsApp and SMS from one service
(`services/notifications`). Three launch templates are defined as data and rendered
by a pure function, so the copy is tested without sending anything.

| Template             | Kind          | Channels             | Used by                                  |
| -------------------- | ------------- | -------------------- | ---------------------------------------- |
| `order_confirmation` | transactional | email, WhatsApp      | order placed                             |
| `cutoff_reminder`    | transactional | email, WhatsApp, SMS | cycle rules, 24 h and 4 h before cut-off |
| `delivery_scheduled` | transactional | email, WhatsApp, SMS | dispatch, the day of the route           |

A template is a subject (email only) and a body holding `{{key}}` placeholders
(`services/notifications/src/templates/template.ts`, tested). A missing value throws
`MissingPlaceholderError` rather than rendering an empty string, because a customer
must never receive "Hi , your order ...". Money is formatted from integer cents
(`formatZar`) and times are rendered in Africa/Johannesburg (`formatJohannesburg`),
so the copy matches the cut-off engine (UTC+2 all year, see `docs/04-cutoff-engine.md`).

## Consent

Transactional messages about an order a person placed do not need marketing consent.
Anything promotional does, per POPIA (see `docs/07-compliance.md`, "opt-in marketing").
`decideConsent` (`services/notifications/src/consent/consent.ts`, tested) allows a
marketing message only when the contact has opted in to that exact channel; an unknown
contact is never sent marketing, because consent cannot be assumed. Consent is stored
per channel, so a customer can allow email but not WhatsApp. The in-memory store is the
default; the SQL adapter reads and writes `notifications.consent`, and the dispatch log
is the `notifications.messages` table. Both are support-only records, so only a staff
session sees them. `STORE_DRIVER=sql` selects the SQL adapters.

## Dispatch

`DispatchService` renders nothing itself: it takes an already-rendered message, asks
`decideConsent`, and either records the outcome or calls the transport for the channel.
Every outcome is written to the dispatch log (`notifications.messages`) with a reason:
`sent`, `suppressed` (with `no_consent` / `unknown_contact`) or `failed` (with
`no_transport` / `transport_error`). A transport error is logged as a reason, not as the
raw error, so a provider message cannot leak into the log.

## Email provider (T-068)

Resend is the provider. `ResendTransport` (`services/notifications/src/channels/resend.ts`)
implements the same `MessageTransport` interface, so dispatch still never branches on the
channel; `transportsFromEnv` prefers Resend when `RESEND_API_KEY` is set and falls back to
the generic `HttpTransport` on `EMAIL_API_URL` for any other provider.

Every email carries **both** an HTML part and a text part. The templates are plain text so
the same copy serves SMS and WhatsApp; `renderHtml`
(`services/notifications/src/templates/html.ts`) turns that text into an email body, and
escapes every value before it reaches the markup, because a customer name is user data.
An HTML-only email is a message some customers never see.

Transactional and marketing mail send from **different addresses**
(`EMAIL_FROM_TRANSACTIONAL`, `EMAIL_FROM_MARKETING`). This is deliberate: a marketing
complaint damages the reputation of the address that earned it, and `order_confirmation`
must not be collateral damage (ADR 0013). An unclassified message is treated as
transactional, the safer default.

### Delivery state

`sent` in the dispatch log means the provider *accepted* the message. It does not mean
delivered. `POST /notifications/delivery/resend` receives Resend's webhook, verifies the
Svix signature over the raw body (enabled in `main.ts`), and records
`email.delivered` / `email.bounced` / `email.complained` against the provider reference.
An unverified request writes nothing, and a webhook is rejected outright when
`RESEND_WEBHOOK_SECRET` is unset, so an unconfigured deployment fails closed.

A bounce or complaint suppresses the address for **marketing**; transactional mail is
still sent, because a customer needs their order confirmation even if a newsletter
bounced. `GET /notifications/delivery/email/:providerRef` returns one message's outcomes
and `GET /notifications/delivery/suppressed` lists suppressed addresses, both behind
`support:manage`.

Each channel implements one `MessageTransport` interface
(`services/notifications/src/dispatch/dispatch.ts`), so dispatch never branches on the
channel. `HttpTransport` (`services/notifications/src/channels/transports.ts`) POSTs
JSON to a provider endpoint with a bearer token; email and WhatsApp differ only in the
URL, the token and the body shape. `transportsFromEnv()` registers a channel only when
its credentials are present, so a half-configured channel records `failed: no_transport`
rather than sending to a broken endpoint. Reads and manual sends are behind
`support:manage`.

## Newsletter

The newsletter list, double opt-in, unsubscribe and paced campaign send live in
`services/notifications/src/newsletter`; see `docs/18-newsletter.md`. It is
deliberately separate from `notifications.consent`, because consent to an order
confirmation is not consent to a newsletter.

## Routes

- `GET /notifications/email`, `GET /notifications/whatsapp`, `GET /notifications/sms` — the dispatch log per channel.
- `POST /notifications/{email,whatsapp,sms}` — render a built-in template and send it.
- `POST /notifications/delivery/resend` — the Resend delivery webhook (signature-authenticated, no session).
- `GET /notifications/delivery/email/:providerRef` — delivery outcomes for one message.
- `GET /notifications/delivery/suppressed` — addresses suppressed by a bounce or complaint.
