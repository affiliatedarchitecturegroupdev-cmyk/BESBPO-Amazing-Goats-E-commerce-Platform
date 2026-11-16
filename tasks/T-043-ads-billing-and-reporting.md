---
id: T-043
title: Ads: wallet billing and reporting
phase: 4
agent: backend
gate: gate:payments
files: ["services/ads/src/billing/**", "services/ads/src/reporting/**"]
---
## Goal
Replace the ads `billing` and `reporting` stubs with wallet ledger operations and spend reporting.

## Acceptance
- [x] Pure rule `debitWallet(ledger, spendCents)` rejects an overspend and returns the new balance
- [x] Billing store over `ads.wallet_ledger`; reporting rollups over `ads.impressions`, `ads.clicks`
- [x] Routes behind `ads:read` / `ads:write`
- [x] Tests added and passing

## Notes
See `docs/06-ads.md`. Wallet movements are money: `gate:payments` review.

Routes use the RBAC permissions `ads:read` / `ads:manage` (the `@ag/rbac` set defines `ads:manage`, not `ads:write`). The SQL adapters over `ads.wallet_ledger`/`ads.impressions`/`ads.clicks` land with T-048; the stores here are the in-memory default whose shape matches those tables.
