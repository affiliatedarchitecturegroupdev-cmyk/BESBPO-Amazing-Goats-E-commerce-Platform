---
id: T-052
title: Run the SQL driver and the migration job on Northflank
phase: 0
agent: devops
gate: gate:infra
files: ["infra/**", "scripts/migrate.sh", "db/Dockerfile", "docs/14-deployment.md"]
---
## Goal
Make the production core actually persist. The services run on the in-memory
stores by default, and nothing applies the schema before they boot, so a
`STORE_DRIVER=sql` deployment had no ledger and an empty database. Wire the SQL
driver into the secret group and run migrations as part of the deploy.

## Acceptance
- [x] The `ag-app-secrets` secret group sets `STORE_DRIVER=sql`
- [x] A migration job builds `db/Dockerfile` and runs before the services
- [x] `scripts/migrate.sh` is re-runnable (records applied files)
- [x] The deploy contract pins the driver and the migration job
- [x] Tests added and passing

## Notes
Northflank's documented pattern for a migration is a `BuildService` (build the
image), a `ManualJob` (deploy it), and a `Build` → `Condition` → `JobRun` chain
in a `migrate` workflow that sits before the service nodes. The image is
`postgres:16` (Debian, so it has bash for `scripts/migrate.sh`) with `db/` and
`scripts/migrate.sh` copied in; `DATABASE_URL` comes from the secret group.

`scripts/migrate.sh` gained a ledger (`public.schema_migrations`): it applies
each file once and skips what is recorded, so the job can run on every deploy.
Each migration runs in one `psql --single-transaction`, so a failure rolls back
and is not recorded.

The gateway rate limiter and the identity audit and MFA stores are still
in-memory. They are separate follow-ups (an audit table exists but is not wired;
MFA and rate-limit state have no table yet), so this card does not claim them.
