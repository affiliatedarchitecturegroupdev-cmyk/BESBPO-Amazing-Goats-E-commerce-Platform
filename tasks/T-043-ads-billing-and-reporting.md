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
- [ ] Pure rule `debitWallet(ledger, spendCents)` rejects an overspend and returns the new balance
- [ ] Billing store over `ads.wallet_ledger`; reporting rollups over `ads.impressions`, `ads.clicks`
- [ ] Routes behind `ads:read` / `ads:write`
- [ ] Tests added and passing

## Notes
See `docs/06-ads.md`. Wallet movements are money: `gate:payments` review.
