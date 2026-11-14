---
id: T-025
title: Credit tiering service and approval workflow
phase: 2
agent: backend
gate: gate:accounts
files: ["services/accounts/**"]
---
## Goal
Credit tiering service and approval workflow.

## Acceptance
- [ ] Uses evaluateTier
- [ ] Large limits need two approvers
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
