---
id: T-036
title: Deployment on Northflank and Koyeb
phase: 0
agent: devops
gate: gate:infra
files: ["infra/**", "docs/14-deployment.md"]
---
## Goal
Make the production and non-core deployment path real and checkable: a valid
Northflank template for the Johannesburg core, a valid Koyeb compose file for the
analytics and forecast services, and a contract test that keeps both in step with
the Dockerfiles, ports and health endpoints the code already exposes.

## Acceptance
- [x] Northflank template is valid and deployable
- [x] Koyeb compose file is valid and deployable
- [x] Tests added and passing
- [x] Docs updated

## Notes
- `infra/northflank/project.json` was a bespoke description, not something
  Northflank accepts. It is now a real template (`apiVersion` `v1.2`, a `Workflow`
  of `Project`, `Addon`, `SecretGroup` and `CombinedService` nodes) for the
  `africa-south` (Johannesburg) region. Addons are Postgres 16 and Redis; the
  secret group links the addon connection strings to `DATABASE_URL` and
  `REDIS_URL` and carries the app secrets from template arguments.
- The template deploys the **launch topology** from `docs/01-architecture.md`
  (gateway, commerce, payments, logistics, notifications and the storefront), not
  all ten services. The remaining services run as modules inside commerce until
  load or team size justifies splitting them out; adding one is a new
  `CombinedService` node.
- `infra/koyeb/analytics.yaml` used a schema Koyeb does not accept. It is
  replaced by `infra/koyeb/koyeb-compose.yaml`, a `koyeb compose` file that
  builds the `analytics` and `ai-forecast` services from their Dockerfiles in
  `fra` (Frankfurt, the closest core region to South Africa) with `/health`
  checks.
- `infra/deploy.spec.mjs` is the contract: both manifests parse, every service
  node names a Dockerfile that exists, each declared port equals the `PORT`
  default in the service `main.ts` (or the Dockerfile `EXPOSE`), each HTTP health
  path is one the app serves, and no plaintext secret is checked in. It runs from
  `pnpm test` through `vitest.deploy.config.mjs`.
- Secrets are never in the repo: the Northflank template reads them from
  `arguments` (filled in the Northflank UI or CI) and the Koyeb file references
  Koyeb secret names.
