---
id: T-078
title: Storefront: delivery-area checker and transparent delivery pricing
phase: 6
agent: frontend
gate: none
files: ["apps/storefront/**", "services/logistics/src/**"]
---
## Goal
The platform delivers across KwaZulu-Natal on a weekly cycle, and a shopper cannot find
out whether their area is served, or what delivery costs, until checkout. That is the
single most common reason a grocery cart is abandoned, and it is the practice a
world-class food platform gets right before anything else.

`CutoffBanner` already surfaces the cycle. What is missing is an area check that answers
"do you deliver to me, when, and for how much" on the product page.

## Acceptance
- [ ] `GET /logistics/zones/check?postalCode=` or `?suburb=` returns `{served, zone, nextSlot, feeCents, cutoffAt}` — a pure lookup over existing zone data, no new schema
- [ ] The check is available from the product page and the cart without a login
- [ ] The answer states the next delivery date and the cut-off that applies, from the cut-off engine (`docs/04-cutoff-engine.md`), not a hard-coded string
- [ ] An unserved area gets an honest answer and a waitlist capture (email, consent-aware), not a dead end
- [ ] Delivery fee is shown in ZAR and marked as excluding or including VAT consistently with `docs/13-pricing.md`
- [ ] The check is cached per postal code and does not call the service on every keystroke
- [ ] Tests added and passing: served, unserved, fee calculation, cache behaviour

## Notes
No gate. Reads existing logistics zone data; if zones are not yet populated, this card
depends on that data being entered rather than on new code.

Do not promise a date the cut-off engine would not meet. The honest answer is the
feature.
