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
- [x] Order lines keep fulfilment type
- [x] Orders after cut-off roll to the next cycle
- [x] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
