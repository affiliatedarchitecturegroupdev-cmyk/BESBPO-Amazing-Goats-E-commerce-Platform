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
- [ ] The gateway forwards `/commerce/*`, `/ads/*`, `/accounts/*`, `/stock/*`, `/logistics/*`, `/notifications/*`, `/partners/*` and `/identity/*` to the owning service's base URL from config
- [ ] The caller's bearer token and the `app.org_id` / `app.staff` session context travel with the forwarded request, so the downstream RLS still scopes the read
- [ ] The existing gateway rate limiter and the auth guard apply before forwarding
- [ ] The OpenAPI aggregation (`GET /gateway/openapi`) reflects the proxied paths
- [ ] A contract test asserts every path `packages/api-client` calls is served by the gateway (fails today)
- [ ] Tests added and passing

## Notes
Gate is `gate:infra` if the proxy reads the service map from `infra/`; keep the
service map in gateway config so the card can land without touching `infra/**`.
This is the highest-impact backend gap: it unblocks the live read path for every
front end, including the T-055 and T-056 storefront screens.
