---
id: T-081
title: Deployment: root Dockerfile and startable container images
phase: 8
agent: human
gate: infra
files: ["Dockerfile", ".dockerignore", "docker-entrypoint.sh", "apps/*/Dockerfile", "services/*/Dockerfile", "infra/deploy.spec.mjs"]
---
## Goal
Northflank cannot find a Dockerfile at the repository root, so a service created with
the platform's default build path has nothing to build. The monorepo keeps one
Dockerfile per workspace (`apps/*/Dockerfile`, `services/*/Dockerfile`) and no root file.

Adding one exposed a worse problem: every Next.js image was unstartable. All six apps
ended in `CMD ["pnpm", "--filter", "@ag/<app>", "start"]`, but `pnpm` is installed with
`corepack enable` in the **build** stage only. The runtime stage copies `/app` and
nothing else, so the container exits immediately with
`Cannot find module '/app/pnpm'`. Northflank reports that as a failed health check
rather than a failed build, so the image builds green, never serves a request, and the
failure looks like a networking or port problem.

`infra/deploy.spec.mjs` did not catch it: it asserted each manifest names a Dockerfile
**that exists**, which every one did, and never read the file.

## Acceptance
- [x] A root `Dockerfile` builds any Node workspace from `--build-arg SERVICE=<name>`
- [x] All six Next.js images start and serve `/health` and a real page
- [x] A `.dockerignore` keeps `node_modules`, `.next` and `.git` out of the build context
- [x] `infra/deploy.spec.mjs` asserts the runtime stage can run its own `CMD`, and fails when a `CMD` regresses to the pnpm form
- [x] The root Dockerfile's coverage of every Node workspace is asserted
- [x] The Python services are documented as building from their own directory
- [x] `docs/14-deployment.md` explains both the root file and the runtime-stage rule
- [x] Human added `human-approved`; PR #88 merged as e80dc38

## Notes
`infra/` is a gated path, so the `agent-gate` check failed until a human added
`human-approved`. The label was added and the PR merged as `e80dc38`.

The two Python services (`analytics`, `ai-forecast`) are not built from the root file.
They need a Python base image and run `pip install .`, which requires their own
directory as the build context — Koyeb's `workdir` already does this. A Northflank
service for them must set `dockerFilePath` to `/services/<name>/Dockerfile` and the
context to that directory.

Do not "fix" a broken image by installing pnpm in the runtime stage when exec'ing the
built binary is available; the runtime stage should not need a package manager.
