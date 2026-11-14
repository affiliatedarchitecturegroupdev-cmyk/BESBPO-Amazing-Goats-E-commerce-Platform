# Messages are templates plus a consent gate, behind one transport

Status: accepted

Every customer message is a template (`services/notifications/src/templates`) rendered
by a pure function: a subject (email only) and a body holding `{{key}}` placeholders.
A missing value throws rather than rendering an empty string, because a customer must
never receive a message with a hole in it. Money is formatted from integer cents and
times in Africa/Johannesburg, so the copy matches the cut-off engine.

Consent is a rule, not a check bolted onto each send. `decideConsent` allows a
transactional message about an order a person placed without consent, and a marketing
message only when the contact opted in to that exact channel. An unknown contact is
never sent marketing, because consent cannot be assumed (POPIA, "opt-in marketing").
Consent is per channel, so email can be allowed while WhatsApp is not.

Dispatch takes an already-rendered message, asks `decideConsent`, and writes every
outcome to a log with a reason (`sent`, `suppressed`, `failed`). Each channel
implements one `MessageTransport`, so dispatch never branches on the channel, and a
transport error is logged as a reason rather than the raw error so provider text
cannot leak into the log. Transports register from the environment only when their
credentials are present, so a half-configured channel fails closed.

The alternative — per-channel send code that each remembers to check consent — was
rejected: the consent rule has to be right in one place, and the copy has to be
testable without sending a real message to a real person.
