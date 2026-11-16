---
id: T-040
title: Commerce: merchandising sections and items
phase: 4
agent: backend
gate: none
files: ["services/commerce/src/merchandising/**"]
---
## Goal
Replace the merchandising stub with curated storefront sections.

## Acceptance
- [x] Pure rule `resolveSection(section, items, catalogue)` applies ordering, pinning and drops unknown SKUs; `visibleSectionsForPage` also drops inactive, out-of-window and empty sections
- [x] Store boundary in place (`MerchandisingStore`); the `catalog.merch_sections`, `catalog.merch_items` SQL adapter lands with T-046
- [x] Routes behind `merch:manage`
- [x] Tests added and passing (13)

## Notes
Feeds the storefront home page (`apps/storefront/lib/merchandising.ts` currently seeds locally).
Implemented in `merchandising.types.ts`, `merchandising.rules.ts`, `merchandising.store.ts`, `merchandising.service.ts`, `merchandising.controller.ts`, `merchandising.module.ts`.
