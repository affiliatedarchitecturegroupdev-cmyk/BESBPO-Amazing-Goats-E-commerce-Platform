# Amazing Goats (Ezimbuzini) platform

Digital agricultural produce orchestration and fulfilment platform: public store, trade portal, admin, driver app, advertiser and partner portals.
A specialised agricultural division of Besbpo Group. Prices exclude VAT unless stated.

## Status
Scaffold v1. Domain rules (cut-off cycles, credit tiering, payment routing, RBAC, ad selection) are implemented as tested pure functions. Everything else is a typed stub for development agents to complete under human review.

## Quick start
```bash
corepack enable && pnpm install
cp .env.example .env
docker compose -f infra/docker-compose.yml up -d     # Postgres, Redis, Mailpit
make db-migrate                                       # applies db/migrations in order
pnpm test                                             # every workspace, plus the bootstrap contract
pnpm --filter @ag/storefront dev                      # http://localhost:3000
```

`pnpm test` is the whole gate: it runs every workspace suite and then the root
bootstrap contract (`scripts/bootstrap.spec.mjs`), which checks the monorepo
wiring itself (workspace scripts, lockfile in step, files CI needs). CI runs the
same commands, so a green `pnpm test` locally means a green `node` job. `make
bootstrap` is install plus that check.

## Layout
```
apps/        Next.js front ends: storefront, trade-portal, admin, driver-pwa, advertiser-portal, partner-portal
services/    NestJS services: gateway, commerce, stock, accounts, logistics, payments, notifications, ads, partners, identity
             FastAPI services: ai-forecast, analytics
packages/    shared-types, rbac, ui-tokens, config
db/          SQL migrations (schema per bounded context), seeds, conventions
infra/       docker-compose, Northflank (production, Johannesburg) and Koyeb (analytics and extras) templates
docs/        architecture, access control, credit, cut-offs, payments, ads, compliance, data model, wireframes, ADRs, estimates
tasks/       agent task cards (backlog) with acceptance criteria and human approval gates
.claude/     Claude Code settings, commands and sub-agents
.openhands/  OpenHands microagents
.github/     CI, PR template, agent task template, CODEOWNERS
```

## Working with agents
Read `AGENTS.md` (all agents) and `docs/10-agentic-workflow.md`. Work comes from `tasks/`. Agents open pull requests; humans approve gated changes.
