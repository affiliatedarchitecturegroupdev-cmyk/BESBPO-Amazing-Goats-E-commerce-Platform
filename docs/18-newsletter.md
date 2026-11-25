# Newsletter

The newsletter is the existing consent rule plus four things it did not have: a
list, a provable opt-in, a working unsubscribe, and a send that can be paced and
resumed. The service is `services/notifications/src/newsletter`.

## The rule this does not break

`notifications.consent` is **not** the subscriber list. Consent to receive an
order confirmation is not consent to receive a newsletter; merging the two would
silently turn every customer who bought something into a marketing list, which
POPIA s18 and CPA s11 penalise (ADR 0013 §3). The list is its own table
(`notifications.subscribers`), and a subscriber reaches `confirmed` only by
clicking a link sent to the address they typed.

`decideConsent` is still the gate on every send. A campaign asks
`DispatchService`, which asks `decideConsent`; a `pending` subscriber receives
nothing marketing even though a row exists for them. Two independent conditions
must hold to receive a campaign: the row is `confirmed`, **and** the contact has
opted in to the `email` channel.

## Double opt-in

`POST /notifications/subscribe` records the intent and sends a confirmation. It
answers `202 {"status":"accepted"}` for every address — new, already confirmed,
invalid, or blocked — so the response cannot be used to learn whether an address
is on the list. Only the person holding the inbox learns the difference, from
whether the email arrives.

`planSubscribe` (`subscriber.ts`, tested) is the whole rule as a pure function:

| Existing row | Action |
| --- | --- |
| none | create a `pending` row, send the confirmation |
| `pending` | resend the confirmation (it may have been lost) |
| `confirmed` | nothing |
| `unsubscribed` | back to `pending`, with new tokens — the click is still required |
| `bounced` / `complained` | nothing; only an explicit re-subscribe revives it |

Addresses are normalised (`trim`, lower-case) and the table has a unique index on
`lower(email)`, so `Thabo@Example.com` and `thabo@example.com` cannot become two
subscribers.

`GET /notifications/subscribe/confirm?token=` moves `pending → confirmed` and
renders a plain HTML page. It is idempotent, because an email client may prefetch
the link and a person may click twice.

## Unsubscribe

`GET /notifications/unsubscribe?token=` works with **no session and no login**:
requiring a login to stop marketing would trap anyone who cannot sign in, and the
link in the email is the credential. It works from any state — someone who never
confirmed is still removed — and it is idempotent.

Every marketing message carries the link (`bodyWithUnsubscribe`), which is what
makes the opt-in revocable rather than a one-way door.

Two separate tokens are minted per subscriber. Sharing one would let a leaked
unsubscribe link confirm an address.

## Campaigns and pacing

A campaign is `draft → sending → sent` (or `cancelled`). A send runs in ticks:
`POST /notifications/campaigns/:id/tick` handles at most 25 recipients by default.
Each recipient's outcome is written to `notifications.campaign_sends` before the
next is attempted, and the unique index on `(campaign_id, subscriber_id)` is what
makes a replay safe — a recipient with a row is skipped.

This is the guarantee, not a code path: a crash mid-tick leaves the campaign
`sending` and the next tick resumes. The wrong answers are a double send (the
person gets two) and a stranded remainder (half the list never hears); the
per-recipient row rules out both.

A `bounced` or `complained` subscriber is never `confirmed`, so `nextBatch`
excludes them from every later campaign. The check is explicit rather than
implied, so a future status cannot quietly leak them in.

## Data minimisation

`ip_hash` is `SHA-256(salt:ip)`, never the raw address. The platform needs to
recognise one source flooding the list, not to know where a subscriber was
(POPIA minimisation). The salt is `NEWSLETTER_IP_SALT`.

## Routes

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /notifications/subscribe` | public | request a subscription; always 202 |
| `GET /notifications/subscribe/confirm` | public (token) | confirm a subscription |
| `GET /notifications/unsubscribe` | public (token) | unsubscribe, idempotent |
| `GET /notifications/subscribers` | `support:manage` | confirmed subscribers only |
| `POST /notifications/campaigns/:id/tick` | `support:manage` | one paced send tick |

The list, campaigns and their outcomes are support-only records under RLS: a
non-staff session sees nothing (verified against a `NOSUPERUSER` role).

## Not in this card

An admin UI for composing a campaign is out of scope — a campaign is created by
API until an editor exists. The stores are in-memory behind the same interfaces a
SQL adapter implements; the tables exist (migration `0021_newsletter.sql`), so
selecting a SQL adapter is the remaining step.
