---
id: T-024
title: Trade portal: application and approval workflow
phase: 2
agent: frontend
gate: none
files: ["apps/trade-portal/**", "services/accounts/**"]
---
## Goal
Trade portal: application and approval workflow.

## Acceptance
- [x] Documents uploaded and checked
- [x] Turnover declaration captured
- [x] Tests added and passing

## Notes
See docs/03-credit-control.md (intake, tiering) and docs/05-payments.md (LulaPay pilot). The application is the intake for the credit workflow: services/accounts/src/credit-applications (pure rules, store, SQL adapter, API) and apps/trade-portal (the wireframed tp-apply/dashboard/credit screens). Migration 0014 adds the intake columns to accounts.credit_applications.
