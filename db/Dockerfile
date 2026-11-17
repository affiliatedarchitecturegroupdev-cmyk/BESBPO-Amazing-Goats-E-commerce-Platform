# Migration image (T-052): psql plus the numbered migrations and seeds.
#
# Built and run by the Northflank migration job before the services deploy, so
# the schema exists when they start. `scripts/migrate.sh` applies each file once
# (public.schema_migrations is the ledger), so re-running the job is a no-op.
#
# The build context is the repository root (Northflank dockerWorkDir "/"), so
# the paths below are repo-relative. postgres:16 is Debian-based and ships bash
# and psql; the alpine tag does not ship bash, which scripts/migrate.sh needs.
FROM postgres:16
WORKDIR /app
COPY db ./db
COPY scripts/migrate.sh ./scripts/migrate.sh
RUN chmod +x ./scripts/migrate.sh
# DATABASE_URL is injected by the Northflank secret group at run time.
CMD ["./scripts/migrate.sh"]
