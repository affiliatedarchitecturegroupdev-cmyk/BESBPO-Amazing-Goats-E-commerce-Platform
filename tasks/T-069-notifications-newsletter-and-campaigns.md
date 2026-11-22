---
id: T-069
title: Notifications: newsletter list, double opt-in, unsubscribe and campaign send
phase: 6
agent: backend
gate: gate:outbound
files: ["services/notifications/src/**", "db/migrations/**", "packages/api-client/**"]
---
## Goal
There is no newsletter. There is, correctly, a consent rule: `decideConsent`
(`services/notifications/src/consent/consent.ts`) refuses marketing without per-channel
opt-in and never sends marketing to an unknown contact. A newsletter is that rule plus
a list, a provable opt-in, a working unsubscribe and a paced send.

The trap this card must not fall into: reusing `notifications.consent` as the
subscriber list. Consent to receive an order confirmation is not consent to receive a
newsletter; merging them silently converts transactional recipients into a marketing
list, which POPIA s18 and CPA s11 penalise (ADR 0013 §3).

## Acceptance
- [ ] Migration adds `notifications.subscribers` (`email`, `status` in `pending|confirmed|unsubscribed|bounced|complained`, `confirm_token`, `confirmed_at`, `unsubscribed_at`, `source`, `ip_hash`, timestamps) with a unique index on lower(email)
- [ ] Migration adds `notifications.campaigns` (`subject`, `body_md`, `status` in `draft|scheduled|sending|sent|cancelled`, `scheduled_for`, `sent_at`, `created_by`) and `notifications.campaign_sends` (one row per recipient with outcome and reason)
- [ ] `POST /notifications/subscribe` accepts an address, always returns 202 regardless of whether it was already subscribed, and sends a confirm email only for `pending` — no address enumeration
- [ ] `GET /notifications/subscribe/confirm?token=` moves `pending → confirmed` and renders a plain confirmation page
- [ ] `GET /notifications/unsubscribe?token=` works with no session and no login, moves the subscriber to `unsubscribed`, and is idempotent
- [ ] Every marketing message carries the unsubscribe link; `decideConsent` is still the gate, and a `pending` subscriber receives nothing marketing
- [ ] Campaign send is paced (a bounded batch per tick) and resumable, so a failure mid-send does not double-send or strand the rest
- [ ] A `bounced` or `complained` subscriber is skipped by every later campaign
- [ ] `ip_hash` is a salted hash, not the raw address (POPIA minimisation)
- [ ] Tests added and passing: double opt-in, no enumeration, idempotent unsubscribe, pacing, bounce skip

## Notes
Gate is `gate:outbound`. Depends on T-068 for the transport and the webhook that
supplies bounce and complaint events.

Admin UI for composing a campaign is deliberately out of scope — this card is the
service and its routes. A campaign can be created by API until an editor exists
(T-077 or later).
