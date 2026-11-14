# Database
One Postgres (Northflank addon, Johannesburg). One schema per bounded context: identity, catalog, inventory, sales, accounts, logistics, payments, ads, partners, audit.
- Migrations are numbered and immutable once merged. New changes need a new file and the `human-approved` label.
- Money is integer cents (ZAR), excluding VAT. Times are UTC.
- Row-level security keys off `app.org_id`, `app.user_id`, `app.staff` set per request by the gateway.
- Seeds: roles and permissions, ad slots, and the staged catalogue CSV.
See `docs/09-data-model.md` for the entity map.
