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
- [x] All migrations apply to a clean database
- [x] RLS policies tested for orders, invoices, campaigns
- [x] Tests added and passing

## Notes
Verified against a real Postgres 16: all 10 migrations and both seeds apply to a
clean database (seed post-conditions 16 lines / 133 products / 140 variants /
140 compliance rows). `db/tests/rls.sql` runs through `scripts/test-rls.sh` and
in the CI `db` job; 18 assertions pass and the test fails when a policy is
removed, so it is a real test. `0011_rls_personal_data.sql` adds policies for the
remaining personal- and customer-data tables. Two things the tests lock in: the
application must connect as a `NOSUPERUSER NOBYPASSRLS` role (superusers and
table owners bypass RLS silently), and the catalogue CSV seed needs the repo root
as the working directory.
