# File structure and conventions
- `apps/<name>/app/**/page.tsx`: one page per wireframe id. Components in `components/`, helpers in `lib/`.
- `services/<name>/src/<module>/`: `<module>.module.ts`, `.controller.ts`, `.service.ts`, `.service.spec.ts`. Business rules live in pure functions beside the service with their own spec.
- `packages/rbac`: roles, permissions, matrix. `packages/nest-auth`: guard, decorator, audit interceptor. `packages/observability`: log redaction, health report, alerts, temperature rules. `packages/db`: Postgres pool, RLS session settings and the store-driver switch. `packages/nest-db`: the Nest wiring (`PersistenceModule`, `AG_DB`, `SessionMiddleware`). `packages/shared-types`: shared enums and types. `packages/api-client`: typed client. `packages/ui-tokens`: brand tokens.
- `db/migrations/NNNN_name.sql`: immutable once merged. `db/seeds`: roles, slots, catalogue CSV.
- `docs/adr/NNNN-title.md`: one decision per file.
- `tasks/T-NNN-slug.md`: one card per unit of agent work.
Naming: kebab-case folders, PascalCase classes and components, snake_case SQL. Tests sit next to code (`*.spec.ts`, `test_*.py`).
