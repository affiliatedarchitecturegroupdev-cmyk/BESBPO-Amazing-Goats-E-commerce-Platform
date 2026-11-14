---
id: T-002
title: Review and apply migrations; add RLS tests
phase: 0
agent: backend
gate: gate:db
files: ["db/migrations/**"]
---
## Goal
Review and apply migrations; add RLS tests.

## Acceptance
- [ ] All migrations apply to a clean database
- [ ] RLS policies tested for orders, invoices, campaigns
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
