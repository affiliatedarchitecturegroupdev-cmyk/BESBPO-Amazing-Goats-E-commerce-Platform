---
id: T-060
title: Storefront: legal, POPIA and consumer information pages
phase: 5
agent: frontend
gate: gate:legal
files: ["apps/storefront/app/(legal)/**", "apps/storefront/components/**"]
---
## Goal
The platform sells food and takes payment from South African consumers, but
carries no legal or consumer information pages at all. `docs/07-compliance.md`
names the rules the site must meet (Consumer Protection Act 68 of 2008, POPIA,
R146 label rules); none of them is surfaced to a shopper.

Build the pages, with copy drafted as a starting point and confirmed by an
attorney before launch (the gate is `gate:legal`).

## Acceptance
- [ ] `/privacy` — POPIA privacy notice: what personal data is collected, why, the lawful basis, retention, the data-subject rights and the information officer contact
- [ ] `/terms` — terms of sale: pricing (excludes VAT unless stated), the weekly cut-off and delivery model, cancellation, and the CPA returns and refund rights
- [ ] `/cookies` — the cookie notice, listing the session cookie and any analytics
- [ ] `/contact` — contact details, trading hours, the corporate link and the physical address
- [ ] `/returns` — the returns and refunds policy, consistent with `docs/05-payments.md`
- [ ] `/about` — who Amazing Goats is, the farm-direct model and the Besbpo Group relationship
- [ ] Each page is reachable from a footer, and the footer also carries the A10 partner logos
- [ ] Tests added and passing

## Notes
Gate is `gate:legal`: copy is drafted here and approved by a person. POPIA
access logging already exists (`audit.data_access_log`, `docs/02-access-control.md`),
so the privacy notice can describe it accurately. Cross-link `/terms` from
checkout, which is where the CPA requires the terms to be shown before payment.
