#!/usr/bin/env bash
# Apply every migration and seed exactly once, in filename order.
#
# Safe to run on every deploy (the Northflank migration job does): applied files
# are recorded in public.schema_migrations and skipped on later runs. The
# migrations are non-idempotent DDL (db/README.md) and immutable once merged, so
# the ledger is what lets a new one land without re-running the old ones.
set -euo pipefail
: "${DATABASE_URL:=postgres://ag:ag@localhost:5432/ag}"

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c "
  CREATE TABLE IF NOT EXISTS public.schema_migrations (
    path text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );"

# Runs a file once. `$2` is the psql transaction flag: migrations have no
# BEGIN/COMMIT of their own, so wrapping each in one keeps a failed migration
# from leaving half-applied state; the seeds manage their own transactions.
apply_once() {
  local f="$1" txflag="${2:-}"
  if [ "$(psql "$DATABASE_URL" -tAc "SELECT 1 FROM public.schema_migrations WHERE path = '$f'")" = "1" ]; then
    echo "skipping $f (already applied)"
    return
  fi
  echo "applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 $txflag -f "$f"
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -c "INSERT INTO public.schema_migrations (path) VALUES ('$f')"
}

for f in db/migrations/*.sql; do apply_once "$f" --single-transaction; done
for f in db/seeds/*.sql; do apply_once "$f"; done
