# Growth, content and experience

Phases 0 to 5 built the platform that *sells*: catalogue, cycles, orders, payments,
logistics, credit, ads and the six front ends. They did not build the platform that
*sells again* — the content, the proof, the conversation and the search presence that
turn a first order into a habit.

This document is the gap analysis for that layer, and the plan for phase 6. It is
written against the existing design: the module boundaries in
`docs/01-architecture.md`, the schemas in `db/migrations/`, the roles in
`packages/rbac/src/roles.ts` and the 36 wireframe screens. Nothing here invents a
new service where a module fits, and nothing here adds a page that has no owner.

## What already exists

Checked against the code, not the plan:

| Capability | State | Where |
| --- | --- | --- |
| Transactional email | **Interface only.** `MessageTransport` with a generic `HttpTransport` that POSTs JSON to `EMAIL_API_URL` with a bearer token | `services/notifications/src/channels/transports.ts` |
| Email templates | 3 templates as data, rendered by a pure function | `services/notifications/src/templates/` |
| Marketing consent | `decideConsent` per channel, opt-in only, unknown contact never sent | `services/notifications/src/consent/` |
| SEO basics | `sitemap.ts`, `robots.ts`, per-page metadata, Open Graph, PWA manifest | `apps/storefront/lib/seo.ts` (T-064) |
| Reviews table | **Schema only.** `sales.reviews` exists with `rating`, `body`, `photo_url`, `approved` | `db/migrations/0005_sales.sql` |
| Reviews code | **None.** No module, no route, no client method | — |
| Structured data (JSON-LD) | **None.** No `application/ld+json` anywhere | — |
| Blog / content | **None.** No table, no route, no app | — |
| Newsletter | **None.** No list, no double opt-in, no campaign | — |
| Social integration | **None** | — |
| Chatbot / assistant | **None.** `services/ai-forecast` is forecasting maths, unrelated | — |

The email situation deserves emphasis: `EMAIL_API_URL` is a *generic* endpoint, so
Resend is a body shape and an endpoint, not a new architecture. That is a strength of
the existing design and it is why T-068 is small.

## Gaps, by area

### 1. Transactional email — provider, not architecture

The transport contract exists but no provider adapter does. Resend needs
`POST https://api.resend.com/emails` with `{from, to, subject, html}` and a
`RESEND_API_KEY`. Three things are missing beyond the endpoint: an HTML body (the
templates render plain text), a `from` identity per message kind, and delivery
webhooks so a bounce or complaint is recorded rather than lost.

A bounce matters commercially: if `order_confirmation` bounces, the customer does not
know their order landed, and they phone. Resend's webhook carries
`email.bounced`, `email.complained`, `email.delivered`, so the dispatch log can record
an outcome instead of assuming `sent` means delivered.

### 2. Newsletter and email marketing — the consent model is already right

`decideConsent` already refuses marketing without per-channel opt-in and refuses
unknown contacts. A newsletter is that model plus four things it does not have: a list
(subscribers who are not yet customers), double opt-in (POPIA and every ESP's
anti-abuse rule require a confirmed address), an unsubscribe path that works without a
login, and campaign send with pacing.

The trap to avoid: reusing `notifications.consent` as the subscriber list. Consent to
receive an order confirmation is not consent to receive a newsletter, and merging them
would quietly convert transactional recipients into a marketing list — the exact
failure POPIA s18 and the CPA s11 penalise. Subscribers get their own table with their
own proof of opt-in.

### 3. Blog and content — needed for search, not for vanity

A food platform in KZN competes on "where to buy lamb in Durban", "how to cook
goat curry", "is halaal lamb available in Pietermaritzburg". Those are questions with
search volume and purchase intent behind them. A blog is the cheapest way to be the
answer.

Content is also the substrate the AI features need. A shopping assistant grounded only
in product rows can answer "what is in the lamb box" and nothing else. Grounded in
recipes, storage guidance and delivery rules, it can answer "how do I cook this" and
"will it arrive frozen" — which is most of what customers actually ask.

One content model serves blog, recipes and buying guides. Recipes already have a
storefront route (`/recipes`, currently a stub) and appear in the wireframes as
`sf-recipes`, so the content type is not speculative.

### 4. SEO and AI-era search — the gap is structured data

T-064 did the mechanical basics. What is missing is what both Google and the new
answer engines actually read:

| Missing | Why it matters |
| --- | --- |
| `Product` JSON-LD with price, availability, `sku` | Rich results and shopping surfaces; without it a product page is just text |
| `Offer` with ZAR currency and VAT treatment | South African price display; the site excludes VAT, and a crawler must be told |
| `AggregateRating` + `Review` | Star ratings in results — only possible once reviews exist (T-070) |
| `Recipe` JSON-LD | Recipe carousels; the single highest-value schema for a food site |
| `LocalBusiness` / `Organization` | Knowledge panel, delivery area, contact |
| `BreadcrumbList` | Category hierarchy in results |
| `FAQPage` | Answers the assistant and answer engines both quote |

"AI-led SEO" is not a separate system. It is: content that answers a question, marked
up so a machine can extract the answer, plus a `llms.txt` and clean HTML so an
assistant can cite it. The plan treats it as an extension of T-064's `seo.ts`, not a
new discipline.

### 5. Ratings and reviews — the rules are the feature

`sales.reviews` exists but enforces neither of the rules you specified. As written any
user can insert any rating for any variant with no purchase. The table needs:

- `order_id` — the purchase that earns the right to review
- a unique `(user_id, variant_id, order_id)` so one order yields one review
- `verified_purchase` derived, not asserted
- a `status` (`pending` / `published` / `rejected`) replacing the bare `approved` flag
- `rejected_reason` and `moderated_by` for the audit trail

The two rules split cleanly and should not be conflated:

| Rule | Meaning | Enforcement |
| --- | --- | --- |
| Registered client may **rate** | 1–5 stars, no text | Any authenticated `customer_household` / `trade_*` user |
| Purchaser may **review** | Stars + text + photo | A `delivered` order line containing that variant, for that user |

A rating is a signal; a review is a publication. Publishing text needs moderation
(R146 of 2010 applies to advertising claims, and a review is user-generated
advertising), so reviews enter `pending` and a person publishes them. Ratings can
aggregate immediately.

### 6. Shopping assistant — grounding is the whole problem

A generic LLM bolted to a storefront will invent prices, promise delivery dates and
invent stock. For a food business that is a compliance problem (R146 misleading
claims) and a commercial one (a quoted wrong price).

The assistant must answer only from retrieved platform facts: catalogue rows with real
prices, cycle cut-offs, delivery zones, the policies in `(legal)`, and content from
T-072. Anything outside that set is refused, not improvised. The design:

```
customer question
  → intent + entity extraction
  → retrieval over a curated fact set (products, policies, content)
  → answer composed ONLY from retrieved facts, with prices injected from the
    catalogue at render time (never generated by the model)
  → citation to the product or policy page
  → if nothing retrieved: "I don't know, here is how to reach a person"
```

Prices are the hard rule: the model selects and explains, it never emits a number that
did not come from a `formatZar` call on a real row.

### 7. Social integration

Three separate things hide under this heading and they are not equally valuable:

- **Share and follow** (cheap, real value): Open Graph is done; add share targets and
  the social links in the footer. Wireframe `sf-home` has a footer slot.
- **Social proof feed** (moderate): pull recent posts into the storefront. Needs a
  token and caching; X/Instagram API access is restrictive and rate-limited.
- **Publish** (higher risk): push new products or posts to social. Gated, because it
  messages the public.

Start with share and follow. The feed is a nice-to-have; publishing is phase 7.

### 8. Other critical pages

Beyond the four storefront stubs (`/delivery`, `/produce`, `/recipes`, `/track`), a
competitive food platform needs: FAQ, a proper 404-with-search, store locator or
delivery-area checker, `/specials`, gift cards (the table exists:
`sales.gift_cards`), and a wishlist. Gift cards and wishlist have schema and no UI.

## Best practice: what a world-class food platform has that we do not

Assessed honestly, with the platform's own constraints (weekly cut-off, chilled
pre-order, KZN delivery, ZAR, POPIA) in mind.

| Practice | Have | Gap | Priority |
| --- | --- | --- | --- |
| Transparent delivery cost and date before checkout | Partial (`CutoffBanner`) | Postcode/area checker on the product page | High |
| Nutrition and allergen data | No | Allergens are a **legal** requirement for pre-packed food; table + display | High |
| Traceability shown to the customer | Batch data exists | "From farm X, packed on date Y" on the product page | High |
| Reviews with verified badge | No | T-070 | High |
| Search that tolerates typos and synonyms | Basic `/search` | Typo tolerance, synonym map ("mutton" → lamb) | High |
| Abandoned cart recovery | No | Email after N hours, consent-aware | Medium |
| Back-in-stock and price-drop alerts | No | Needs wishlist + consent | Medium |
| Subscription management UI | Table exists | Customer-facing pause/skip/edit | Medium |
| Referral programme | No | Later | Low |
| Loyalty / points | No | Later | Low |
| Product comparison | No | Low for 140 SKUs | Low |
| Live chat with a human | No | Assistant handles first line | Medium |
| Accessibility (WCAG 2.2 AA) | Storefront audited, 0 axe violations | Portals and driver PWA still to audit; see `21-accessibility-and-performance.md` | High |
| Core Web Vitals budget | Set and enforced in CI | LCP 2.5 s, CLS 0.1, TTFB 800 ms; see `21-accessibility-and-performance.md` | High |
| Analytics and funnels | No (Koyeb analytics is KPIs, not web analytics) | Privacy-friendly web analytics | High |

Two of these are legal rather than competitive: **allergen disclosure** for pre-packed
food, and **accessibility**. They belong in phase 6, not "later".

## Phase 6 shape

Thirteen cards, ordered so each unblocks the next. Reviews before structured data
(you cannot mark up ratings you do not have). Content before the assistant (the
assistant needs something to retrieve). Email before newsletter (same transport).

| Card | Deliverable | Service / app | Gate |
| --- | --- | --- | --- |
| T-068 | Resend email transport, HTML bodies, delivery webhooks | notifications | `gate:outbound` |
| T-069 | Newsletter list, double opt-in, unsubscribe, campaign send | notifications | `gate:outbound` |
| T-070 | Ratings and reviews with verified-purchase rules and moderation | commerce | `gate:db` |
| T-071 | Content model and blog (posts, categories, authors) | commerce | `gate:db` |
| T-072 | Recipes as content, replacing the `/recipes` stub | commerce + storefront | none |
| T-073 | Structured data and AI-era SEO (JSON-LD, `llms.txt`) | storefront | none |
| T-074 | Shopping assistant: grounded retrieval, refusal, citations | new `assistant` module in gateway BFF | `gate:new-dependency` |
| T-075 | Social share, follow links and Open Graph completion | storefront | none |
| T-076 | Allergen and nutrition data model and display | commerce | `gate:legal` |
| T-077 | Remaining storefront pages (delivery, produce, track, FAQ, 404) | storefront | none |
| T-078 | Delivery-area checker and transparent pricing | storefront + logistics | none |
| T-079 | Wishlist, back-in-stock alerts, abandoned-cart recovery | commerce + notifications | `gate:outbound` |
| T-080 | Accessibility and Core Web Vitals audit and fixes | all apps | none |

### Sequencing

```
T-068 ──┬─> T-069 ─────────────────────┐
        └─> T-079 (cart recovery) ─────┤
T-070 ──┬─> T-073 (AggregateRating) ───┤
        └─> T-078                     │
T-071 ──┬─> T-072 ──┐                 ├─> T-080 (audit last, on real pages)
        └───────────┴─> T-074 ────────┤
T-075 ────────────────────────────────┘
T-076 ──> T-073 (allergens in schema)
T-077 ──> T-073 (new pages need markup)
```

T-068 first because three cards depend on it. T-074 last of the feature cards because
it retrieves from everything above it. T-080 last overall because auditing a moving
target wastes the audit.

### What phase 6 deliberately does not do

- **No new deployable.** The assistant is a module in the gateway BFF, per ADR 0002.
  It has no schema of its own beyond a conversation log.
- **No vector database at launch.** The fact set is small (140 products, a dozen
  policies, a few dozen posts) and structured. Retrieval is filtered catalogue queries
  plus keyword search over content. A vector store is added only if recall proves
  inadequate, and that is a separate decision with a separate ADR.
- **No customer-facing AI that writes prices.** Non-negotiable; see ADR 0013.
- **No social publishing.** Share and follow only.

## Risks

| Risk | Mitigation |
| --- | --- |
| Assistant quotes a wrong price or invents stock | Prices injected from catalogue rows at render time; model never emits a number; tests assert refusal |
| Newsletter becomes a spam vector and damages the sending domain | Double opt-in, unsubscribe in every message, pacing, bounce handling from T-068 |
| Reviews attract abuse or defamation | Purchaser-only text, moderation queue, `rejected_reason`, audit |
| AI content dilutes the brand or makes false claims | Human review before publish; R146 claims check; no auto-publish |
| Structured data drifts from the rendered page | JSON-LD generated from the same objects the page renders, asserted in tests |
| Allergen data is wrong | Sourced from `product_compliance`, shown as supplier-declared, legal review gate |
