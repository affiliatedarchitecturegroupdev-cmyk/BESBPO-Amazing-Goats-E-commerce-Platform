---
id: T-080
title: All apps: accessibility and Core Web Vitals audit and fixes
phase: 6
agent: qa
gate: none
files: ["apps/**", "packages/ui-tokens/**"]
---
## Goal
Neither accessibility nor performance has ever been measured. Both are competitive
requirements and accessibility is arguably a legal one: WCAG 2.2 AA is the standard a
South African public-facing service is held to, and the Consumer Protection Act
requires information to be accessible to an ordinary consumer.

This card audits and fixes, and it is deliberately last in phase 6 so it audits real
pages rather than stubs.

## Acceptance
- [ ] An automated accessibility pass (axe or equivalent) over every storefront public route, with results recorded in the task
- [ ] Fixes for what it finds: colour contrast against `packages/ui-tokens`, focus order, form labels, landmark structure, keyboard traps in the cart and checkout
- [ ] Keyboard-only walkthrough of the purchase path recorded: browse → cart → checkout → confirmation
- [ ] Screen-reader sanity check on the product page and checkout, documented
- [ ] Core Web Vitals measured on the storefront's heaviest routes (home, category, product); LCP, CLS and INP recorded
- [ ] A performance budget set and documented, and a regression test or CI check that fails when it is exceeded
- [ ] Images use `next/image` with explicit dimensions so CLS stays low
- [ ] The driver PWA's offline queue path re-checked, since it is used one-handed outdoors
- [ ] Findings and fixes written into `docs/17-growth-and-experience.md` or a new accessibility note

## Notes
No gate, but findings may create follow-up cards; do not silently fix a design token in
a way that changes the brand without recording it.

Audit the real pages, which is why this is last. Auditing the four stub routes before
T-077 would waste the pass.
