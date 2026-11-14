---
id: T-019
title: Notifications: email and WhatsApp templates
phase: 1
agent: backend
gate: gate:outbound
files: ["services/notifications/**"]
---
## Goal
Notifications: email and WhatsApp templates.

## Acceptance
- [x] Templates for confirmation, cut-off reminder, delivery
- [x] Opt-in respected
- [x] Tests added and passing

## Notes
- Three launch templates as data (`services/notifications/src/templates/catalogue.ts`):
  `order_confirmation` (email, WhatsApp), `cutoff_reminder` (email, WhatsApp, SMS) and
  `delivery_scheduled` (email, WhatsApp, SMS). All transactional.
- Rendering is a pure function (`template.ts`, tested): `{{key}}` placeholders, a
  missing value throws `MissingPlaceholderError` instead of rendering an empty string.
  Money is formatted from integer cents (`formatZar`); times render in
  Africa/Johannesburg (`formatJohannesburg`), matching the cut-off engine.
- Opt-in: `decideConsent` (`consent/consent.ts`, tested) allows a transactional message
  without consent and a marketing message only when the contact opted in to that exact
  channel; an unknown contact is never sent marketing. Consent is per channel.
- Dispatch (`dispatch/dispatch.service.ts`): asks consent, then records `sent`,
  `suppressed` (reason `no_consent` / `unknown_contact`) or `failed` (`no_transport` /
  `transport_error`). A transport error is logged as a reason, not the raw error, so a
  provider message cannot leak. One `MessageTransport` per channel; `HttpTransport`
  POSTs JSON with a bearer token and `transportsFromEnv()` registers a channel only
  when its credentials are present. Routes stay behind `support:manage`.
- Store is in-memory for now (`InMemoryConsentStore`, `InMemoryDispatchLog`); the SQL
  adapters read `identity.users.marketing_opt_in` and write `notifications.messages`.
  See `docs/16-notifications.md` and ADR `0008`.
