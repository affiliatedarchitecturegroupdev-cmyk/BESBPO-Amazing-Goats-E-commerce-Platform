# Deployment

Two platforms, split by what the traffic is.

**Northflank (managed cloud, Johannesburg, `africa-south`)** runs the core:
the gateway, commerce, payments, logistics and notifications services, the
storefront, and the Postgres and Redis addons. Keeping the core in South Africa
keeps round trips short for customers and staff and keeps personal data (POPIA)
in country.

**Koyeb (Frankfurt, `fra`)** runs the non-core services: analytics, reporting,
forecasts, plus staging and preview deployments. Koyeb has no African region, so
it runs in the closest core region and relies on its edge network for delivery.

```
Northflank  africa-south (Johannesburg)          Koyeb  fra (Frankfurt)
  Postgres 16 addon  (schema per context)          analytics    (FastAPI, :8000)
  Redis 7 addon      (queues, cache, pacing)       ai-forecast  (FastAPI, :8000)
  gateway      :3000  public
  commerce     :3001  vpc
  payments     :3005  vpc
  logistics    :3004  vpc
  notifications:3006  vpc
  storefront   :3000  public
```

## Launch topology

`docs/01-architecture.md` says to start with fewer deployables and run the rest
as modules until load or team size justifies splitting them out. The Northflank
template deploys exactly that launch set. Adding a service later is a new
`CombinedService` node in `infra/northflank/project.json`; the folders, schemas
and OpenAPI files already exist per service, so it is a deployment change.

## Northflank

`infra/northflank/project.json` is a Northflank template (`apiVersion` `v1.2`).
It is one `Workflow` of nodes: a `Project` in `africa-south`, a nested workflow
that creates the two addons, a `SecretGroup`, and a `CombinedService` per
service.

Apply it from the Northflank app (**Templates → Create**, paste the file) or the
CLI:

```bash
northflank create template --file infra/northflank/project.json
```

### Secrets

No secret is checked in. The template declares `arguments` (`JWT_ISSUER`,
`PEACH_ACCESS_TOKEN`, `WHATSAPP_TOKEN`, and so on); fill them in when you run
the template, and they are written into the `ag-app-secrets` secret group as
`${args.*}` references. The group also links the addons so `DATABASE_URL` and
`REDIS_URL` resolve to the addon connection strings, with no copy-paste.

Changing any of this file needs the `human-approved` label (`infra/**` is a
gated path).

## Koyeb

`infra/koyeb/koyeb-compose.yaml` is a `koyeb compose` file. Apply it with the
Koyeb CLI:

```bash
koyeb compose infra/koyeb/koyeb-compose.yaml
```

Each service builds from its own Dockerfile (`workdir` plus `docker.dockerfile`)
in `fra`, exposes `:8000`, and is probed at `/health`. `DATABASE_URL` references
the Koyeb secret `ag-analytics-db-url` by name; create it in the control panel or
with `koyeb secret create ag-analytics-db-url --value <value>`. Never put the
value in this file.

## The contract test

`infra/deploy.spec.mjs` runs as part of `pnpm test` (through
`vitest.deploy.config.mjs`). It fails the build when the manifests drift from
the code:

- the Northflank template is `v1.2`, its `Project` is in `africa-south`, and it
  has Postgres and Redis addons;
- the secret group links `DATABASE_URL` and `REDIS_URL`, and every credential
  variable is an `${args.*}` reference rather than a literal;
- every service node names a Dockerfile that exists, and its port equals the
  `PORT` default in that service's `main.ts` (or `EXPOSE 3000` for a Next.js
  app);
- every HTTP health path is one the app serves (`/health` for every service and
  every Next.js app, which serves it from `app/health/route.ts`);
- the Koyeb services build existing Dockerfiles in real regions and reference
  secrets by name, never by value.

Run just this test with:

```bash
vitest run --config vitest.deploy.config.mjs
```

## Adding a front end

The other Next.js apps (`trade-portal`, `admin`, `driver-pwa`,
`advertiser-portal`, `partner-portal`) follow the storefront: a `CombinedService`
node on port 3000 with `dockerFilePath` `/apps/<name>/Dockerfile` and an HTTP
health check on `/health`, served by `app/health/route.ts`. Add them when they
have something to serve.
