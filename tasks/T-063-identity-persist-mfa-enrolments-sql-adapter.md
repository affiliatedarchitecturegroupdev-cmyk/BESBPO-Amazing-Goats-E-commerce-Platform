---
id: T-063
title: Identity: persist MFA enrolments (SQL adapter)
phase: 5
agent: backend
gate: gate:db
files: ["services/identity/src/mfa/**", "db/migrations/**"]
---
## Goal
MFA uses `InMemoryMfaStore`, so every enrolment is lost on restart and a staff
member is silently un-enrolled — which defeats the "MFA for all staff" rule in
`docs/02-access-control.md`. Found while checking persistence coverage for the
sign-in work (T-058).

## Acceptance
- [ ] A `mfa.sql-store.ts` behind `MfaStore`, selected by `selectStore`/`STORE_DRIVER`
- [ ] A migration adds `identity.mfa_enrolments` (subject, encrypted secret, confirmed-at) with RLS so only the subject and staff may read a row
- [ ] The TOTP secret is encrypted at rest (field-level, as `docs/02-access-control.md` requires)
- [ ] `beginEnrolment`/`confirm`/`verify` round-trip through the adapter
- [ ] A `describe.skipIf(!admin)` integration spec runs against Postgres and cleans its own rows
- [ ] Tests added and passing

## Notes
Gate is `gate:db`. The other identity stores (`users`, `access`) already have
SQL adapters; follow `users.sql-store.ts`. Secret encryption should reuse
whatever the identity service uses for personal-data fields.
