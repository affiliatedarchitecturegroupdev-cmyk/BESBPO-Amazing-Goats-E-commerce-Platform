---
id: T-011
title: Orders: cart to order, cycle assignment
phase: 1
agent: backend
gate: none
files: ["services/commerce/src/orders/**"]
---
## Goal
Orders: cart to order, cycle assignment.

## Acceptance
- [ ] Order lines keep fulfilment type
- [ ] Orders after cut-off roll to the next cycle
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
