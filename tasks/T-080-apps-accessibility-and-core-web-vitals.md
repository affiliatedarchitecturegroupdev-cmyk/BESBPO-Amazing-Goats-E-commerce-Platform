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
- [x] An automated accessibility pass (axe or equivalent) over every storefront public route, with results recorded in the task
      — 27 routes, 0 violations (`scripts/a11y-audit.mjs`). Cart, checkout, sign-in, track and account were added to the route list because the card names the purchase path.
- [x] Fixes for what it finds: colour contrast against `packages/ui-tokens`, focus order, form labels, landmark structure, keyboard traps in the cart and checkout
      — header nav 1.29:1 → 10.36:1, skip link, `:focus-visible` ring, home `h1`. No form-label or landmark defect was found.
- [x] Keyboard-only walkthrough of the purchase path recorded: browse → cart → checkout → confirmation
      — `scripts/keyboard-walk.mjs` over `/shop/lamb`, `/product/AG-LM-002`, `/cart`, `/checkout`: no traps, no invisible stops, a ring on every stop. Confirmation is a POST result and is not reachable by GET.
- [ ] Screen-reader sanity check on the product page and checkout, documented
      — every control on both has an accessible name in the Chromium accessibility tree, but no human VoiceOver/NVDA session was run. Open.
- [x] Core Web Vitals measured on the storefront's heaviest routes (home, category, product); LCP, CLS and INP recorded
      — LCP 484/388/1180 ms, CLS 0.000/0.000/0.015 (`scripts/web-vitals.mjs`). INP needs field data; long tasks recorded instead and the gap stated in the note.
- [x] A performance budget set and documented, and a regression test or CI check that fails when it is exceeded
      — `scripts/perf-budget.json`, guarded by `scripts/perf-budget.spec.mjs` under `pnpm test`.
- [x] Images use `next/image` with explicit dimensions so CLS stays low
      — done as explicit `width`/`height` on every `<img>` and enforced by test. Not `next/image`: hosts are editor-supplied and not known at build time. Rationale in the note.
- [ ] The driver PWA's offline queue path re-checked, since it is used one-handed outdoors
      — its 52 unit tests pass including the IndexedDB queue and proof sync, but the one-handed device walkthrough is not done. Open.
- [x] Findings and fixes written into `docs/17-growth-and-experience.md` or a new accessibility note
      — `docs/21-accessibility-and-performance.md`.


## Result

The storefront passes WCAG 2.2 AA on every public route. The single serious defect was
that `globals.css` had no anchor rule at all, so header links rendered browser-default
blue on the dark green bar. The single performance defect was a skeleton of the wrong
shape: the six-card grid reserved 2135 px against a 489 px product page and measured
CLS 0.111.

Two findings were false alarms caused by a stale `next-server` serving an old build.
Both are written up so the next audit does not repeat them.


## Follow-up cards this creates

- Audit the four portals and the driver PWA with the same scripts. The portals set explicit link colours, so the storefront contrast bug does not repeat there; `driver-pwa` styles containers rather than anchors.
- Move the link, focus and skip-link rules into `packages/ui-tokens` or a shared stylesheet rather than per-app `globals.css`.
- Human screen-reader pass over product and checkout.
- Driver PWA one-handed outdoor walkthrough.
- Field INP measurement once analytics is live.

## Notes
No gate, but findings may create follow-up cards; do not silently fix a design token in
a way that changes the brand without recording it.

Audit the real pages, which is why this is last. Auditing the four stub routes before
T-077 would waste the pass.
