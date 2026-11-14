# Backlog
Human approves gated tasks. Phase 0 foundations, 1 launch, 2 trade and range, 3 monetise and scale.

| ID | Title | Phase | Agent | Gate |
|---|---|---|---|---|
| T-001 | Monorepo bootstrap and green CI | 0 | devops | gate:infra |
| T-002 | Review and apply migrations; add RLS tests | 0 | backend | gate:db |
| T-003 | Map the catalogue CSV into products and variants | 0 | backend | none |
| T-004 | Identity provider integration and role sync | 0 | backend | gate:rbac |
| T-005 | JWT verification in nest-auth | 0 | backend | gate:rbac |
| T-006 | Persist audit log | 0 | backend | gate:db |
| T-007 | Gateway BFF and OpenAPI aggregation | 0 | backend | none |
| T-008 | Catalogue service CRUD and search | 1 | backend | none |
| T-009 | Pricing: price lists, tiers and VAT | 1 | backend | gate:pricing |
| T-010 | Cycle engine service and scheduler | 1 | backend | none |
| T-011 | Orders: cart to order, cycle assignment | 1 | backend | none |
| T-012 | Stock, batches and traceability | 1 | backend | none |
| T-013 | Payments: provider interface and Peach adapter | 1 | backend | gate:payments |
| T-014 | PayFast adapter and automatic fallback | 1 | backend | gate:payments |
| T-015 | Stitch adapter: pay by bank and recurring debits | 1 | backend | gate:payments |
| T-016 | Webhooks, reconciliation and refunds | 1 | backend | gate:payments |
| T-017 | Storefront: home, category and product pages | 1 | frontend | none |
| T-018 | Storefront: cart and checkout | 1 | frontend | none |
| T-019 | Notifications: email and WhatsApp templates | 1 | backend | gate:outbound |
| T-020 | Logistics: zones, slots and routes | 1 | backend | none |
| T-021 | Driver PWA: offline queue and sync | 1 | frontend | none |
| T-022 | Admin: orders, cycles and batches screens | 1 | frontend | none |
| T-023 | Admin: roles and access management | 1 | frontend | gate:rbac |
| T-024 | Trade portal: application and approval workflow | 2 | frontend | none |
| T-025 | Credit tiering service and approval workflow | 2 | backend | gate:accounts |
| T-026 | Invoices, statements and collections schedule | 2 | backend | gate:accounts |
| T-027 | TradeSafe and LulaPay adapters | 2 | backend | gate:payments |
| T-028 | Ads: campaigns, creatives and review queue | 3 | backend | none |
| T-029 | Ads: decisioning and storefront placements | 3 | backend | none |
| T-030 | Partner portal: slots and purchase orders | 2 | frontend | none |
| T-031 | Confirm provider fees and settlement terms | 1 | human | gate:payments |
| T-032 | Compliance fields and label generator | 2 | backend | gate:legal |
| T-033 | Dairy and fresh produce onboarding | 3 | backend | none |
| T-034 | Observability, logging and alerts | 1 | devops | gate:infra |
| T-035 | End-to-end tests for core journeys | 1 | qa | none |
| T-036 | Deployment on Northflank and Koyeb | 0 | devops | gate:infra |
