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
default; the SQL adapter reads `identity.users.marketing_opt_in`.

## Dispatch

`DispatchService` renders nothing itself: it takes an already-rendered message, asks
`decideConsent`, and either records the outcome or calls the transport for the channel.
Every outcome is written to the dispatch log (`notifications.messages`) with a reason:
`sent`, `suppressed` (with `no_consent` / `unknown_contact`) or `failed` (with
`no_transport` / `transport_error`). A transport error is logged as a reason, not as the
raw error, so a provider message cannot leak into the log.

Each channel implements one `MessageTransport` interface
(`services/notifications/src/dispatch/dispatch.ts`), so dispatch never branches on the
channel. `HttpTransport` (`services/notifications/src/channels/transports.ts`) POSTs
JSON to a provider endpoint with a bearer token; email and WhatsApp differ only in the
URL, the token and the body shape. `transportsFromEnv()` registers a channel only when
its credentials are present, so a half-configured channel records `failed: no_transport`
rather than sending to a broken endpoint. Reads and manual sends are behind
`support:manage`.

## Routes

- `GET /notifications/email`, `GET /notifications/whatsapp`, `GET /notifications/sms` — the dispatch log per channel.
- `POST /notifications/{email,whatsapp,sms}` — render a built-in template and send it.
