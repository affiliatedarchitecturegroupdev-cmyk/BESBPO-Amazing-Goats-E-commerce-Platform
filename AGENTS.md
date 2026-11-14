# Agent instructions (OpenHands, Claude Code, any agent)

## Mission
Build the Amazing Goats platform from `tasks/BACKLOG.md`, one task card at a time, with a human reviewer in the loop.

## Ground rules
1. Work only on the task card you were given. Read its `files`, `acceptance` and `gate` fields first.
2. Branch name: `agent/<task-id>-<slug>`. Never push to `main`. Open a PR using the template.
3. Write or update tests with every change. Run `pnpm -r test` and `pnpm -r lint` (TypeScript) or `pytest` (Python services) before opening a PR.
4. Money is integer cents (ZAR). Times are stored in UTC and shown in Africa/Johannesburg. Prices in the database exclude VAT; VAT (15%) is added at display and invoice time.
5. Every table, endpoint and screen must respect RBAC (`packages/rbac`). Use `@RequirePermissions(...)` on every controller route.
6. Never read or write `.env`, secrets, or production data. Use `.env.example` and seed data.
7. No new dependency, no schema migration edit after merge, and no change to gated paths without the human approval label.

## Human approval gates (label `human-approved` required to merge)
- `db/migrations/**` (new migrations are fine as PRs; edits to merged files are forbidden)
- `packages/rbac/**`, auth, session and identity code
- `services/payments/**` and any money movement, refunds, payouts, reconciliation
- `services/accounts/**` credit limits, tiering and collections logic
- pricing, VAT and promotion logic in `services/commerce/**`
- `infra/**`, `.github/**`, deployment and environment configuration
- legal and regulatory text: terms, privacy, labels, ad policy, compliance copy
- anything that sends email, WhatsApp or SMS to real people

## Definition of done
Tests pass, lint passes, docs updated if behaviour changed, PR description lists what changed, risks, and how to verify. For UI work include a screenshot or wireframe reference from `docs/wireframes/index.html`.

## Compliance reminders
POPIA (consent, minimal personal data, access logging), Consumer Protection Act, R146 food labelling and advertising rules, Agricultural Product Standards Act packing and marking, Meat Safety Act. See `docs/07-compliance.md`. If unsure, stop and ask in the PR.

## Style
TypeScript strict, small modules, pure functions for business rules, DTO validation with class-validator, OpenAPI for every service, conventional commits.

## Agent workflow note
When branching from `main`, do not run `git reset --hard` (or `git checkout -f`) while the working tree has uncommitted edits to already-tracked files: it discards them, and a later commit then contains only newly-added files. Commit or `git stash -u` first, and check `git status` is clean before switching branches.

## Session learnings
- **Optional Nest dependencies need a token.** A bare constructor parameter that is not a provider makes Nest throw `Nest can't resolve dependencies of X (..., ?)` and the service never boots. Inject optional collaborators as `@Optional() @Inject(SOME_TOKEN) x: T = default`, and provide `{ provide: SOME_TOKEN, useFactory: ... }`. This bit `PermissionsGuard`, `AccessService` (clock) and `MfaService` (issuer).
- **Share one store instance** between a request interceptor and an API that reads it: declare the provider in the owning module and `exports:` it, rather than declaring it in both.
- **Pure rules + a store boundary.** Keep business rules as pure functions (no I/O, clock passed in) and put persistence behind an interface with an in-memory default. That is what makes them unit-testable without a database.
- **No Postgres in the test sandbox.** `postgresql` is not installed and cannot be added, so assert SQL-level guarantees (e.g. the append-only triggers) by reading the migration file in a test; `process.cwd()` is the package dir under vitest, so resolve `../../db/...` from there.
- **Local monorepo runner:** `tsc --noEmit -p tsconfig.json` for lint and `vitest run` per package/service/app; build a package (`tsc -p packages/x/tsconfig.json`) before a service that imports its `dist` can boot. `dist/` is gitignored.
- **Merge workflow used:** branch `agent/<task>-<slug>` → push → `create_pr` with labels `agent-pr,human-approved` → mark ready → wait for `ci` and `agent-gate` → merge via `PUT .../merge-async` (poll the uuid) → `git fetch origin main && git reset --hard origin/main`.

