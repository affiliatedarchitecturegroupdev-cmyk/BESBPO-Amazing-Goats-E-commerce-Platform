---
id: T-055
title: Storefront: discovery and content pages
phase: 4
agent: frontend
gate: none
files: ["apps/storefront/**"]
---
## Goal
Three planned screens are `TODO(agent)` stubs: `sf-produce` (dairy and produce
with the bakery egg programme), `sf-recipes` (recipes and cut guide with the
guest calculator, A9), and `sf-delivery` (zone checker, fees, route days).

## Acceptance
- [ ] `/produce` lists eggs, milk, butter, cheese, vegetables and herbs with the trade entry for bakeries
- [ ] `/recipes` has a working guest-to-quantity calculator and the cut guide, plus the A9 sponsored ingredient
- [ ] `/delivery` shows the zone table, the fee per zone and the route days
- [ ] Tests added and passing

## Notes
`docs/wireframes/index.html#sf-produce`, `#sf-recipes`, `#sf-delivery`. The
delivery zones and route days come from the logistics service (`docs/01-architecture.md`).
