---
id: T-057
title: Storefront: design system, fonts, imagery and responsive shell
phase: 4
agent: frontend
gate: none
files: ["apps/storefront/**"]
---
## Goal
The design is only partly realised. Fraunces and Inter are named in CSS but
never loaded (no `next/font`, no `@font-face`), so the page falls back to Georgia
and the system font. There is no `public/` directory, so product tiles show
dashed placeholders. The header is a desktop flex row, but the wireframes are
mobile-first with a bottom nav.

## Acceptance
- [ ] Fraunces (display) and Inter (body) load through `next/font`
- [ ] Product imagery ships in `public/` and renders through `next/image`
- [ ] The header is responsive and a footer carries the A10 partner logos
- [ ] Per-page metadata and a sitemap
- [ ] Tests added and passing

## Notes
Brand palette, type and the triangle strip are in `docs/design-system/README.md`
and `packages/ui-tokens`. The strip runs at edges and bases only, never behind
text. Final logo artwork is supplied by the designer.
