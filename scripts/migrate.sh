#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:=postgres://ag:ag@localhost:5432/ag}"
for f in db/migrations/*.sql; do echo "applying $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
for f in db/seeds/*.sql; do echo "seeding $f"; psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done
