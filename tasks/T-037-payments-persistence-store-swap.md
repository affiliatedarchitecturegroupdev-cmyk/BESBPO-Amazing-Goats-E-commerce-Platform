---
id: T-037
title: Persist the payments stores (SQL adapters behind the store boundary)
phase: 1
agent: backend
gate: gate:db,gate:payments
files: ["packages/db/**", "services/payments/**", "db/migrations/**", ".github/workflows/ci.yml"]
---
## Goal
Make the payments stores persist to Postgres without changing the domain. Every store
keeps its interface and its in-memory default; `STORE_DRIVER=sql` selects the SQL
adapters, which all go through the new `@ag/db` package.

## Acceptance
- [x] `@ag/db` owns the pool, the row-level-security session and the store-driver switch
- [x] `STORE_DRIVER=memory` (default) keeps tests and local runs database-free
- [x] SQL adapters for intents, provider events, refunds, payouts, chargebacks and reconciliation
- [x] `payments.chargebacks` table added (it was modelled in the domain but absent from 0008)
- [x] Integration tests assert scoping through a `NOSUPERUSER, NOBYPASSRLS` role, and skip without `DATABASE_URL`
- [x] Tests and lint passing

## Notes
**Why `@ag/db`.** The one thing every adapter must get right, and the one that is easy to
get wrong, is the row-level-security session: `app.org_id`, `app.user_id`, `app.staff`
must be set per request, transaction-locally, and the connection must be a role that does
not bypass the policies. `Db.withSession(context, fn)` wraps that. Putting it in one
package means a new service cannot re-implement it subtly differently.

**Store boundary.** Business rules stay pure functions beside the service (see AGENTS.md);
storage goes behind an interface with an in-memory default. `selectStore(inMemory,
buildSql)` keeps the pool lazy, so a service on the memory driver boots with no database.

**Session context.** The request session is carried in an `AsyncLocalStorage`
(`runWithSession`/`currentSession`), set by a Nest middleware from the caller the auth
guard resolved, so an adapter reads it without threading it through every store signature.
An unauthenticated request (a provider webhook) gets an empty, default-deny session.

**Domain/schema bridge.** The domain uses opaque string ids; the schema uses `uuid`
primary keys. Intent ids are now `randomUUID()`; idempotency is preserved through the
unique key on `payments.intents.idempotency_key`.

See `docs/adr/0012-persistence-and-store-swap.md` and `docs/05-payments.md` ("Persistence").
