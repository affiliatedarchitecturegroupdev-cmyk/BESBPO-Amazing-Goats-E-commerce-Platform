---
id: T-001
title: Monorepo bootstrap and green CI
phase: 0
agent: devops
gate: gate:infra
files: [".github/**", "package.json"]
---
## Goal
Monorepo bootstrap and green CI.

## Acceptance
- [x] pnpm install works
- [x] CI passes on an empty PR
- [x] Tests added and passing

## Notes
- `pnpm install --frozen-lockfile` succeeds; the lockfile is in step with all 22
  workspace manifests.
- `scripts/bootstrap.spec.mjs` (run by `pnpm test` and the CI `node` job) is the
  bootstrap contract: workspace globs, every workspace declares lint and test,
  test scripts tolerate a package with no tests yet (a bare `vitest run` exits 1
  when it has no specs and breaks `pnpm -r test` on a fresh checkout), the
  lockfile is in step, and the files CI relies on are present. Verified in both
  directions: it passes on the repo and fails when a workspace drops its specs.
- CI `node` job runs install, package build, lint and `pnpm test`; it now also
  runs on pushes to `main`, so a bad merge cannot land unnoticed.
- Two facts the test pins down: `services/ai-forecast` and `services/analytics`
  are Python and have no `package.json` (only the `python` job covers them), and
  `pnpm` may be reachable only through `corepack`.
