# Stores behind an interface, with one SQL session boundary in @ag/db
Status: accepted

Every service keeps its business rules as pure functions and puts storage behind a store
interface with an in-memory default (`InMemory*Store`). The default driver is memory, so
tests and local runs need no database; `STORE_DRIVER=sql` selects the SQL adapters. One
switch for the whole service, so a deployment cannot end up with half its stores
persisted. `selectStore(inMemory, buildSql)` keeps the pool (and the `DATABASE_URL`
check) lazy — it only runs when the SQL driver is chosen, so a service that never touches
the database still boots.

The SQL adapters all go through `@ag/db`. It owns the one thing each adapter must get
right and is easy to get wrong: the row-level-security session. `Db.withSession(context,
fn)` opens a transaction, applies `app.org_id`, `app.user_id` and `app.staff` with a
parameterised `set_config(..., true)`, runs `fn`, and commits or rolls back. The `true`
makes the settings transaction-local and the parameters mean a value cannot be injected.
The application connects as a `NOSUPERUSER, NOBYPASSRLS` role (`db/README.md`), because a
superuser or a table owner bypasses the policies silently and the session settings would
do nothing; the `@ag/db` integration test asserts scoping through such a role to catch a
regression to a privileged connection.

The request's session is carried in an `AsyncLocalStorage` (`runWithSession` /
`currentSession`), so an adapter reads it without threading the context through every
store signature. A store with no ambient session gets an empty context, which is
default-deny under the policies — the safe failure.

The alternative — a query builder (Drizzle, Prisma) or a per-service data-access copy —
was rejected: the schema is already hand-written and immutable once merged, and the RLS
session is a single correctness concern that must not be re-implemented per service. The
in-memory default also keeps the unit suite fast and database-free, which is what lets
the rules stay testable without a container.

Adapters land service by service. `services/payments` is first (intents, provider events,
refunds, payouts, reconciliation, chargebacks); the other services keep their in-memory
stores until their own swap.
