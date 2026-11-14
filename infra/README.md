# Infrastructure

- `docker-compose.yml` — local Postgres 16, Redis 7 and Mailpit for development.
- `northflank/project.json` — the production core in Johannesburg. A Northflank
  template (`apiVersion` `v1.2`): project, Postgres and Redis addons, a secret
  group, and a service per launch-topology deployable.
- `koyeb/koyeb-compose.yaml` — the non-core services (analytics, forecasts,
  staging, previews) on Koyeb in `fra`.
- `deploy.spec.mjs` — the deployment contract, run by `pnpm test`. It fails when
  a manifest drifts from the Dockerfiles, ports and health endpoints in the code.
- `observability/notification-integration.json` — the alert and log-drain wiring
  for Northflank and Koyeb, and the environment the application reads. See
  `docs/15-observability.md`.

See `docs/14-deployment.md` for the topology and how to apply each template.

`infra/**` is a gated path: changes need the `human-approved` label.
