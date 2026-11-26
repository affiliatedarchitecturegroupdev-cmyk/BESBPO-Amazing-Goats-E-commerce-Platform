# Backlog
Human approves gated tasks. Phase 0 foundations, 1 launch, 2 trade and range, 3 monetise and scale, 4 range and storefront depth, 5 launch readiness, 6 growth, content and experience.

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
| T-037 | Persist the payments stores (SQL adapters) | 1 | backend | gate:db,gate:payments |
| T-038 | Commerce: promotions engine and store | 4 | backend | gate:pricing |
| T-039 | Commerce: subscriptions and standing orders | 4 | backend | none |
| T-040 | Commerce: merchandising sections and items | 4 | backend | none |
| T-041 | Identity: users administration | 4 | backend | gate:rbac |
| T-042 | Gateway: auth session and rate limiting | 4 | backend | gate:rbac |
| T-043 | Ads: wallet billing and reporting | 4 | backend | gate:payments |
| T-044 | Analytics: warehouse-backed KPIs | 4 | backend | none |
| T-045 | AI forecast: persist buy suggestions | 4 | backend | none |
| T-046 | Persist the commerce stores (SQL adapters) | 4 | backend | gate:db |
| T-047 | Persist the identity, logistics and stock stores (SQL adapters) | 4 | backend | gate:db |
| T-048 | Persist the ads, partners and notifications stores (SQL adapters) | 4 | backend | gate:db |
| T-049 | Apps: wire storefront and trade portal to the gateway | 4 | frontend | none |
| T-050 | Apps: wire admin, driver, advertiser and partner portals to the gateway | 4 | frontend | none |
| T-051 | Persist the remaining commerce stores (SQL adapters) | 4 | backend | gate:db |
| T-053 | Storefront: make the cart real (add, update, remove, checkout) | 4 | frontend | none |
| T-054 | Storefront: merchandising sections and occasion pages | 4 | frontend | none |
| T-055 | Storefront: discovery and content pages | 4 | frontend | none |
| T-056 | Storefront: account, tracking and trade entry | 4 | frontend | none |
| T-057 | Storefront: design system, fonts, imagery and responsive shell | 4 | frontend | none |
| T-058 | Identity and gateway: sign-in front door (OIDC and session) — done | 5 | backend | none |
| T-059 | Apps: sign-in screens, session guard and role-aware navigation | 5 | frontend | none |
| T-060 | Storefront: legal, POPIA and consumer information pages | 5 | frontend | gate:legal |
| T-061 | Gateway: reverse proxy for /commerce, /ads and /accounts | 5 | backend | gate:infra |
| T-062 | Commerce: persist the merchandising store (SQL adapter) | 5 | backend | gate:db |
| T-063 | Identity: persist MFA enrolments (SQL adapter) | 5 | backend | gate:db |
| T-064 | Apps: error, not-found and loading screens; SEO and PWA basics | 5 | frontend | none |
| T-065 | Logistics: implement proof of delivery (read, capture, temperature) — done | 5 | backend | none |
| T-066 | Driver PWA: IndexedDB offline queue and day-close — done | 5 | frontend | none |
| T-067 | Infra: deploy the remaining front ends (trade, admin, driver, advertiser, partner) — done | 5 | devops | gate:infra |
| T-068 | Notifications: Resend email transport, HTML bodies and delivery webhooks | 6 | backend | gate:outbound |
| T-069 | Notifications: newsletter list, double opt-in, unsubscribe and campaign send | 6 | backend | gate:outbound |
| T-070 | Commerce: ratings and reviews with verified-purchase rules and moderation | 6 | backend | gate:db |
| T-071 | Commerce: content model and blog | 6 | backend | gate:db |
| T-072 | Storefront: recipes from content, replacing the /recipes stub | 6 | frontend | none |
| T-073 | Storefront: structured data and AI-era SEO | 6 | frontend | none |
| T-074 | Gateway: grounded shopping assistant with refusal and citations | 6 | backend | gate:new-dependency |
| T-075 | Storefront: social share, follow links and Open Graph completion | 6 | frontend | none |
| T-076 | Commerce: allergen and nutrition data model and display | 6 | backend | gate:legal |
| T-077 | Storefront: remaining public pages (delivery, produce, track, FAQ, 404) | 6 | frontend | none |
| T-078 | Storefront: delivery-area checker and transparent delivery pricing | 6 | frontend | none |
| T-079 | Commerce: wishlist, back-in-stock alerts and abandoned-cart recovery | 6 | backend | gate:outbound |
| T-080 | All apps: accessibility and Core Web Vitals audit and fixes | 6 | qa | none |
| T-081 | Deployment: root Dockerfile and startable container images | 8 | human | gate:infra |
| T-082 | Commerce: anonymous catalogue read behind an active-only RLS session | 5 | backend | gate:rbac |
