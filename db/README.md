# Database
One Postgres (Northflank addon, Johannesburg). One schema per bounded context: identity, catalog, inventory, sales, accounts, logistics, payments, ads, partners, audit.
- Migrations are numbered and immutable once merged. New changes need a new file and the `human-approved` label.
- Money is integer cents (ZAR), excluding VAT. Times are UTC.
- Row-level security keys off `app.org_id`, `app.user_id`, `app.staff` set per request by the gateway.
- **The application must connect as a role that is not a superuser and not the table owner.** Both bypass row-level security silently, so policies would do nothing. Create it once:
  ```sql
  CREATE ROLE ag_app LOGIN PASSWORD '...' NOSUPERUSER NOBYPASSRLS;
  GRANT USAGE ON SCHEMA identity, catalog, inventory, sales, accounts, logistics, payments, ads, partners, audit TO ag_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA identity, catalog, inventory, sales, accounts, logistics, payments, ads, partners, audit TO ag_app;
  ```
- Migrations and seeds apply to a **clean** database (they are not idempotent). To bring one up and run the row-level security tests:
  ```bash
  make db-reset            # docker compose down -v, up, then ./scripts/migrate.sh
  ./scripts/test-rls.sh    # applies migrations + seeds, then db/tests/rls.sql
  ```
  `db/tests/rls.sql` is the source of truth for the policies: default deny, org and user scoping, staff bypass, and the superuser-bypass trap. CI runs it in the `db` job.
- Seeds: roles and permissions, ad slots, and the staged catalogue CSV.
See `docs/09-data-model.md` for the entity map.
