#!/usr/bin/env bash
# Apply migrations to a clean database and run the row-level security tests.
# Used by CI (db job) and locally:
#   make db-reset && ./scripts/test-rls.sh
# Point DATABASE_URL at the database to test (default: the docker-compose Postgres).
set -euo pipefail
: "${DATABASE_URL:=postgres://ag:ag@localhost:5432/ag}"

echo "applying migrations to $DATABASE_URL"
for f in db/migrations/*.sql; do
  echo "  $f"
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done

# Seeds are part of bringing a database up: this also proves the catalogue CSV
# import resolves (it needs the repo root as the working directory).
echo "applying seeds"
for f in db/seeds/*.sql; do
  echo "  $f"
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -f "$f"
done

echo "running RLS tests"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/tests/rls.sql
