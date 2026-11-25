---
id: T-061
title: Gateway: reverse proxy for /commerce, /ads and /accounts
phase: 5
agent: backend
gate: gate:infra
files: ["services/gateway/src/**", "packages/api-client/**"]
---
## Goal
`packages/api-client` calls `/commerce/*`, `/ads/*`, `/accounts/*` on the
gateway base URL, but the gateway serves only `/gateway/*` and `/health`. There
is no reverse proxy, Next route handler or rewrite anywhere, so every live read
from the storefront and the other apps cannot reach its service in a deployed
environment. Found during T-054; nothing exercises it yet because the front ends
still fall back to fixtures.

## Acceptance
- [x] The gateway forwards `/commerce/*`, `/ads/*`, `/accounts/*`, `/stock/*`, `/logistics/*`, `/notifications/*`, `/partners/*` and `/identity/*` to the owning service's base URL from config
- [x] The caller's bearer token and the `app.org_id` / `app.staff` session context travel with the forwarded request, so the downstream RLS still scopes the read
- [x] The existing gateway rate limiter and the auth guard apply before forwarding
- [x] The OpenAPI aggregation (`GET /gateway/openapi`) reflects the proxied paths
- [x] A contract test asserts every path `packages/api-client` calls is served by the gateway (fails today)
- [x] Tests added and passing

## Notes
Gate is `gate:infra` if the proxy reads the service map from `infra/`; keep the
service map in gateway config so the card can land without touching `infra/**`.
This is the highest-impact backend gap: it unblocks the live read path for every
front end, including the T-055 and T-056 storefront screens.

Landed as a catch-all controller registered after every route the gateway serves
itself, so `/health` and `/gateway/*` always win over the proxy. The prefix map
is `services/gateway/src/proxy/proxy.routes.ts`; the upstream addresses come from
`<NAME>_URL` (else the local ports) via `readUpstreamsFromEnv`, so no `infra/**`
change was needed. The `x-ag-*` identity headers are stripped at the edge so a
caller cannot widen its own row-level scope; the owning service re-derives
identity from the bearer token. Still to do when the template is next touched:
set `COMMERCE_URL` and friends in `infra/northflank/project.json` to the internal
service addresses, so a deployed gateway reaches its services rather than the
localhost defaults.
