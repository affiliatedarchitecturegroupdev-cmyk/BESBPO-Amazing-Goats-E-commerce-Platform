---
id: T-054
title: Storefront: merchandising sections and occasion pages
phase: 4
agent: frontend
gate: none
files: ["apps/storefront/**", "services/gateway/src/bff/**"]
---
## Goal
`sf-merch` is a stub (`/boxes`, `/occasions/[slug]`) and the home page builds its
sections inline. T-040 shipped the merchandising service (`resolveSection`,
`visibleSectionsForPage`, store, routes) but the storefront never reads it, and
the BFF `home()` returns one hardcoded section. Wire curated sections through.

## Acceptance
- [ ] BFF `home()` returns the visible merchandising sections for the page, resolved against the catalogue
- [ ] `/occasions/[slug]` renders a real hub (hero, bundles, cooking method, budget, sponsored, recipes)
- [ ] `/boxes` lists the boxes line from the catalogue
- [ ] Home renders the merchandising sections from the service, not inline
- [ ] Tests added and passing

## Notes
`resolveSection` drops SKUs no longer in the catalogue, so a retired product
never leaves a broken tile. Sections are half-open `[startsAt, endsAt)` windows;
`visibleSectionsForPage` drops inactive, out-of-window and empty sections.

## Screen
`docs/wireframes/index.html#sf-merch`.
