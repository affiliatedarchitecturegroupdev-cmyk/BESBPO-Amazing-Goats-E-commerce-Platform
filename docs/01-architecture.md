# Architecture
Hosting: Northflank managed cloud, Johannesburg, with Northflank Postgres and Redis. Koyeb hosts analytics, reporting and other non-core services (and staging or previews).

```
Browsers and phones
  storefront | trade-portal | admin | driver-pwa | advertiser-portal | partner-portal   (Next.js)
        |
     gateway (NestJS: auth, RBAC, rate limits, BFF)
        |
  commerce | stock | accounts | logistics | payments | notifications | ads | partners | identity   (NestJS)
  ai-forecast | analytics   (FastAPI)
        |
  Postgres (schema per context)  +  Redis (queues, cache, pacing)
```
**Launch topology.** Start with fewer deployables: gateway, commerce (catalogue, pricing, orders, cycles), payments, logistics, notifications. Run the other services as modules inside these until load or team size justifies splitting them out (see ADR 0002). Each service still has its own folder, schema and OpenAPI file, so splitting is a deployment change.

**Rules.** Services talk through HTTP APIs and events on Redis streams (Kafka only if volume demands). A service reads only its own schema. Cross-context reads go through APIs or published events. Money is integer cents. Times are UTC.
