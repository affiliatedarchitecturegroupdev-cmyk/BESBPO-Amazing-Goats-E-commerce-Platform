---
id: T-045
title: AI forecast: persist buy suggestions
phase: 4
agent: backend
gate: none
files: ["services/ai-forecast/**"]
---
## Goal
Persist buy suggestions as drafts a buyer must approve (`app/main.py` `# TODO(agent)`).

## Acceptance
- [x] `POST /suggest-buy` writes a draft suggestion; `GET /suggestions` lists drafts; `POST /suggestions/{id}/approve` promotes one
- [x] Pure forecast maths in `forecast.py` unchanged; persistence is a thin store
- [x] pytest tests added and passing

## Notes
See `docs/11-estimates.md`. Runs on Koyeb. Persistence is `app/suggestions.py` (the approval rule plus an in-memory store); `forecast.py` is unchanged.
