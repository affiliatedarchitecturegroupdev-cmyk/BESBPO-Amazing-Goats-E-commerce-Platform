# Agentic, human-in-the-loop workflow
Tools: Claude Code (`.claude/`) and OpenHands (`.openhands/`). Both read `AGENTS.md`.

**Loop**
1. A human (or the planner agent) writes or picks a task card in `tasks/` (goal, files, acceptance, gate).
2. An implementer agent branches `agent/<id>-<slug>`, plans, writes code and tests, runs `pnpm -r test`.
3. The agent self-reviews with the `review` command and opens a PR from the template.
4. CI runs lint, tests and the **agent-gate** workflow. Gated paths need the `human-approved` label.
5. A human reviews (CODEOWNERS), approves or sends back. Merging is always human.
6. A separate reviewer agent may comment, but never merges.

**Gates (human required):** db migrations, rbac and auth, payments, credit and pricing logic, infra and CI, legal and compliance text, anything that messages real people, new dependencies, production deployment.

**Autonomy levels:** L1 agents draft in branches (default). L2 agents may merge docs and tests-only PRs. L3 (never): production changes, secrets, money movement.

**Safety:** agents work in sandboxes with `.env.example` only; no production data; no force pushes; no edits to merged migrations; network limited to package registries; every agent PR lists risks.

**Cadence:** weekly planning picks 5 to 10 tasks; daily 15 minute review of open agent PRs; monthly review of gates and permissions. Track cycle time, rework rate, defects found after merge, and agent cost per merged task.

**Getting started:** `make bootstrap`, start with T-001, T-002 and T-005, then follow `tasks/BACKLOG.md`.
