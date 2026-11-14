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
- [ ] pnpm install works
- [ ] CI passes on an empty PR
- [ ] Tests added and passing

## Notes
See docs for the relevant design section. Ask the human before touching gated paths.
