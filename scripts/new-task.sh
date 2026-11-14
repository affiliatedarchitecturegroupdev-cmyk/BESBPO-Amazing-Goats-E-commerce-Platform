#!/usr/bin/env bash
# usage: scripts/new-task.sh T-123 "short title"
set -euo pipefail
id="$1"; title="$2"; slug=$(echo "$title" | tr 'A-Z ' 'a-z-' | tr -cd 'a-z0-9-')
cat > "tasks/${id}-${slug}.md" <<TASK
---
id: ${id}
title: ${title}
phase: 1
agent: backend
gate: none
files: []
---
## Goal
## Acceptance
- [ ] Tests added and passing
TASK
echo "created tasks/${id}-${slug}.md"
