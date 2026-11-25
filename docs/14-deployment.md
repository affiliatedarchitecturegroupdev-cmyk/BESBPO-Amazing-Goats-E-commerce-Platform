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

## Sign-in (T-058)

The gateway is the only place a session is created. `GET /gateway/auth/login`
redirects to the identity provider, `GET /gateway/auth/callback` exchanges the
code and sets an httpOnly cookie, and `POST /gateway/auth/logout` clears it.
Portals send a browser with no session to `loginUrl(returnTo)` from
`@ag/api-client`; they never hold the token themselves.

Set these on the gateway service:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs the session cookie **and** the OIDC `state`. Required. |
| `OIDC_ISSUER` | Realm issuer, e.g. `https://id.amazinggoats.co.za/realms/ag` |
| `OIDC_CLIENT_ID` | Client registered for the gateway |
| `OIDC_REDIRECT_URI` | Must match the IdP registration exactly, including scheme |
| `OIDC_SCOPES` | Defaults to `profile email`; `openid` is always added |
| `OIDC_ID_TOKEN_SECRET` | HS256 realms only |
| `OIDC_ID_TOKEN_PUBLIC_KEY` | RS256 realms (the usual case) |
| `SESSION_MINUTES` | Session lifetime, default 15 |
| `REFRESH_MINUTES` | Longest a session can be renewed, default 480 |
| `STAFF_IP_ALLOWLIST` | Comma-separated IPs/CIDRs for staff routes |

`JWT_SECRET` is not in the Northflank template's `arguments`; add it as a
secret before enabling sign-in. Without `OIDC_ISSUER` and `OIDC_CLIENT_ID` the
login route answers 503 rather than redirecting somewhere broken.

Two things worth knowing before changing this:

- **The session cookie is the only copy of the token.** It is httpOnly, so a
  portal cannot read it — which is the point — and every call is made
  server-side or through the gateway. If you need a browser-side call, add a
  route on the portal server rather than unsetting `HttpOnly`.
- **`STAFF_IP_ALLOWLIST` restricts staff callers only.** External trade and
  partner users reach their own routes from anywhere, which is what they need
  in the field. The same list also runs in the admin portal's middleware; both
  are needed because one stops a browser loading a page and the other stops a
  token being replayed from off-network.

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
  secrets by name, never by value;
- all six front ends have a node, on port 3000, with `/health`; the admin is
  private and the driver PWA is public and serves its manifest;
- the admin's `ADMIN_IP_ALLOWLIST` is a template argument wired into the secret
  group, and the middleware reads it;
- staging builds real Dockerfiles, scales to zero, and uses only `ag-staging-*`
  secrets.

Run just this test with:

```bash
vitest run --config vitest.deploy.config.mjs
```

## Front ends

All six Next.js apps deploy as a `CombinedService` node on port 3000 with
`dockerFilePath` `/apps/<name>/Dockerfile` and an HTTP health check on `/health`,
served by `app/health/route.ts`:

| App | Port | Public | Notes |
|---|---|---|---|
| `storefront` | 3000 | yes | public shop |
| `trade-portal` | 3000 | yes | wholesale ordering |
| `driver-pwa` | 3000 | yes | installable PWA, needs HTTPS for the service worker |
| `advertiser-portal` | 3000 | yes | campaigns and wallet |
| `partner-portal` | 3000 | yes | partner orders and documents |
| `admin` | 3000 | **no** | private route, staff IP allow-list only |

A new front end is a new node in the same shape; `infra/deploy.spec.mjs` fails
the build if one of the six loses its node, its port or its health check.

## Dockerfiles

Every deployable has its own Dockerfile next to its code, and that is the
preferred path: it gives each service its own build cache and build plan.

There is also a **root `Dockerfile`**. Northflank's default build path is
`/Dockerfile`, so a service created through the UI without overriding the path
reports "cannot find the Dockerfile on the repository root" unless one exists.
The root file builds any Node workspace from a build argument:

```bash
docker build --build-arg SERVICE=gateway    -t ag-gateway .
docker build --build-arg SERVICE=storefront -t ag-storefront .
```

`SERVICE` is the workspace directory name. `docker-entrypoint.sh` starts a
Next.js app with `next start` and a NestJS service with its compiled
`dist/main.js`. The two Python services (`analytics`, `ai-forecast`) are not
built from the root file — they need a different base image and run
`pip install .`, so they build from their own directory, which is what Koyeb's
`workdir` sets.

Two rules the images depend on, both asserted by `infra/deploy.spec.mjs`:

- **The runtime stage must be able to run its own `CMD`.** The Next.js images
  use `node node_modules/next/dist/bin/next start` rather than `pnpm --filter
  ... start`, because the runtime stage copies the built workspace but not the
  pnpm shim. A `CMD` that runs `pnpm` there fails at container start with
  `Cannot find module '/app/pnpm'`, which surfaces as a failed health check
  rather than a failed build.
- **The build context excludes `node_modules`, `.next` and `.git`** via
  `.dockerignore`. Without it every Node build sends roughly 600 MB to the
  daemon before compiling anything.

### Admin access

The admin portal is on the private route and is additionally gated by the staff
IP allow-list (`apps/admin/middleware.ts`, rule in `apps/admin/lib/ip-allowlist.ts`).
It reads `ADMIN_IP_ALLOWLIST` — a comma-separated list of addresses and CIDR
blocks, for example `196.25.1.0/24,41.13.7.20`.

Set it on the admin service before first deploy. An **empty or unset** value
disables the filter, which is correct for local development and wrong in
production: it would leave a portal holding every permission open to anyone who
reaches the route. `/health` is exempt so the platform's readiness probe, which
comes from Northflank's network rather than the office, does not fail and
restart a healthy service.

### Staging and previews

`infra/koyeb/koyeb-staging.yaml` runs the front door and the storefront in `fra`,
scaling to zero when idle. It is a separate compose file from the non-core one
because that file is all-Python on `:8000` while staging runs Node on `:3000`;
the contract test asserts the port per file, so folding them together would lose
the check for both. Staging secrets are named `ag-staging-*` and must never be
the production addon — the test fails if a production secret name appears here.
