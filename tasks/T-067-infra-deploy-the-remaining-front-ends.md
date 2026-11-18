---
id: T-067
title: Infra: deploy the remaining front ends (trade, admin, driver, advertiser, partner)
phase: 5
agent: devops
gate: gate:infra
files: ["infra/northflank/project.json", "infra/koyeb/koyeb-compose.yaml", "infra/deploy.spec.mjs"]
---
## Goal
The Northflank template deploys only the gateway, commerce, payments, logistics,
notifications and the storefront. The other five Next.js apps have a Dockerfile
and a `/health` route but no deployment node, so `trade-portal`, `admin`,
`driver-pwa`, `advertiser-portal` and `partner-portal` cannot be reached in
production.

## Acceptance
- [ ] A `CombinedService` node per remaining app in `infra/northflank/project.json` (port 3000, `/health`, `dockerFilePath` `/apps/<name>/Dockerfile`)
- [ ] The admin app sits behind the staff IP allow-list (from T-058) and a private route, not the public one
- [ ] The driver PWA is reachable over HTTPS with the PWA manifest served
- [ ] Koyeb runs the non-core extras (reporting, previews) per `docs/14-deployment.md`
- [ ] `infra/deploy.spec.mjs` is extended to assert a node per app, and passes
- [ ] Tests added and passing

## Notes
Gate is `gate:infra` (`human-approved` label). `docs/14-deployment.md` describes
the pattern ("Adding a front end"); the apps "follow the storefront". Add them
once their live reads resolve, which T-061 provides.
