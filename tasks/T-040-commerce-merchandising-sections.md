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
- [ ] Pure rule `resolveSection(section, items, catalogue)` applies ordering, pinning and drops inactive or unknown SKUs
- [ ] Store over `catalog.merch_sections`, `catalog.merch_items`
- [ ] Routes behind `catalog:read` / `catalog:write`
- [ ] Tests added and passing

## Notes
Feeds the storefront home page (`apps/storefront/lib/merchandising.ts` currently seeds locally).
