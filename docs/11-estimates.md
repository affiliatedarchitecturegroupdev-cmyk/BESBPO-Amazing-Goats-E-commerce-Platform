# Size estimates (lines of code and files)
Estimates are planning figures, about plus or minus 35%. They exclude lockfiles, build output, generated API clients and `node_modules`. Agent-written code tends to run 20 to 40 percent more verbose than hand-written code.

## Full platform (phases 0 to 3)
| Component | Production LoC | Notes |
|---|---:|---|
| gateway | 5,000 | auth, RBAC, rate limits, BFF |
| commerce | 22,000 | catalogue, pricing, orders, cycles, subscriptions, promotions, merchandising |
| stock | 8,000 | batches, traceability, temperature, recalls |
| accounts | 14,000 | applications, tiering, invoices, collections, statements |
| logistics | 12,000 | zones, slots, routes, driver sync, proof of delivery |
| payments | 14,000 | seven provider adapters, webhooks, reconciliation, refunds, payouts |
| notifications | 5,000 | email, WhatsApp, SMS |
| ads | 9,000 | campaigns, review, decisioning, billing, reporting |
| partners | 7,000 | purchase orders, slots, documents |
| identity | 6,000 | users, roles, audit APIs, IdP integration |
| ai-forecast and analytics (Python) | 13,000 | forecasts, KPIs, reporting |
| storefront | 30,000 | about 40 routes, merchandising, checkout |
| admin | 32,000 | 16 modules |
| trade portal | 14,000 | |
| driver app | 11,000 | offline queue and sync |
| advertiser portal | 9,000 | |
| partner portal | 6,000 | |
| shared UI and packages | 16,000 | UI kit, types, RBAC, client, tokens |
| database (SQL) | 7,000 | migrations, functions, seeds |
| infra, CI, scripts | 4,000 | |
| **Production total** | **about 244,000** | |
| Tests | about 100,000 | roughly 40 percent of production |
| Docs, tasks, config | about 20,000 | |
| **Grand total** | **about 365,000** | |

Files: about 2,200 production files (average 110 lines), about 1,200 test files (average 85 lines), about 400 config, docs and task files: **roughly 3,500 files** (range 2,800 to 3,800).

## Launch scope (phases 0 and 1)
About 90,000 to 120,000 production LoC, 35,000 to 50,000 test LoC, and 1,000 to 1,400 files.

## What this scaffold already contains
See the repository counts in the delivery note: roughly 490 files, about 5,600 non-blank lines in total, about 2,750 lines of code across 327 code files, 55 test files with 37 passing tests covering RBAC, cut-off cycles, VAT, credit tiering, payment routing and fees, ad selection, offline sync and forecasting.
