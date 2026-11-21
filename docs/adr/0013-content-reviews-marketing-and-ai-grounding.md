# Content, reviews, marketing and AI grounding

Status: proposed (needs human approval — `gate:legal` and `gate:outbound` apply)

Phase 6 adds four things that touch real people and real money: marketing email,
published user content, structured data that search engines trust, and an AI assistant
that speaks for the business. This ADR fixes the rules they all share, so twelve task
cards do not each invent their own.

## 1. Content lives in commerce, as a module

Blog posts, recipes and buying guides share one model: a slug, a title, a body, an
author, a status, a publish date, taxonomy. They are content *about* products, and
they link to products, so they belong beside the catalogue rather than in a new
service. Per ADR 0002 they are a module inside commerce at launch.

```sql
catalog.content (
  id, kind ('post'|'recipe'|'guide'), slug UNIQUE, title, summary,
  body_md, author_user_id, status ('draft'|'review'|'published'|'archived'),
  published_at, hero_image_url, seo_title, seo_description,
  taxonomy text[], created_at, updated_at
)
catalog.content_products (content_id, variant_id)   -- what a post is about
catalog.content_recipes  (content_id, servings, prep_minutes, cook_minutes,
                          ingredients jsonb, steps jsonb)  -- recipe extras
```

**Decision:** body is Markdown, not HTML. Markdown is diffable, safe to render after
sanitising, and a non-technical author can write it. Rendering to HTML happens once,
in a pure function that is tested — the same pattern as the notification templates.

**Decision:** `status` has four states, not a boolean. `draft → review → published →
archived`. An agent may move `draft → review`; only a person moves `review →
published`, because a published page is a public claim (R146 of 2010).

## 2. Reviews: rating and review are different acts

Already decided in `docs/17-growth-and-experience.md`, recorded here because it is the
kind of rule that gets eroded by convenience.

| Act | Who | Enforced by |
| --- | --- | --- |
| Rate (1–5, no text) | Any authenticated customer or trade user | role check |
| Review (text, photo) | A user with a `delivered` order line for that variant | query against `sales.order_lines` + order status |

The database enforces what it can: a unique `(user_id, variant_id, order_id)`, a
`rating BETWEEN 1 AND 5`, and `verified_purchase` set by the service from the order,
never from the request body. A review with no `order_id` cannot be inserted.

**Decision:** text reviews are published only after moderation. Ratings aggregate
immediately. The aggregate shown on a product page is the mean of *published* reviews
and all ratings, with the count of each shown separately, so a product with 40 ratings
and 2 reviews does not imply 40 written reviews.

**Decision:** no review editing after publish. A customer may delete their own review;
a corrected review is a new row. This keeps the moderation record honest.

## 3. Marketing email: separate consent, separate list, double opt-in

`decideConsent` already refuses marketing without opt-in. That is necessary and not
sufficient for a newsletter, because a newsletter reaches people who are not yet
customers and whose consent must be provable.

**Decision:** `notifications.subscribers` is its own table, with its own proof:
`email`, `status` (`pending`|`confirmed`|`unsubscribed`|`bounced`), `confirm_token`,
`confirmed_at`, `source`, `ip_hash`, `unsubscribed_at`. `notifications.consent` is
never used as a subscriber list and a subscriber is never created by copying consent
from an order.

**Decision:** double opt-in is mandatory. `pending` subscribers receive nothing
marketing. A single confirm click moves them to `confirmed`. Every marketing message
carries a one-click unsubscribe that works without a login and without a session.

**Decision:** transactional and marketing sends use different `from` identities and
different subdomains if the provider allows, so a marketing complaint cannot degrade
deliverability of `order_confirmation`. This is the single highest-value operational
decision in the email workstream.

## 4. AI assistant: grounded, refusing, and never quoting a number it did not read

The assistant answers questions about products, prices, cut-offs, delivery and how the
business works. It must not become a second, unaudited source of truth.

**Rules, in priority order:**

1. **Prices and stock are never generated.** The model returns a *selection* (a SKU or
   a set of SKUs); the answer is composed by code that reads the row and formats the
   price with `formatZar`. If a number appears in an answer, it came from the
   database. A test asserts that a prompt asking for a price returns a value equal to
   the catalogue row.
2. **Answer only from retrieved facts.** Retrieval is over: catalogue rows, cycle and
   cut-off data, delivery zones, the legal pages, and published content. No retrieved
   fact means no answer.
3. **Refuse rather than improvise.** Out-of-scope questions get a fixed refusal that
   names a human channel. The refusal text is a constant, not model output.
4. **Cite.** Every answer names the product or page it drew from, as a link.
5. **No promises the platform cannot keep.** Delivery dates come from the cut-off
   engine, not from the model.
6. **Log for audit.** Every conversation is recorded with the retrieved fact ids, so a
   disputed answer can be reconstructed. Conversation logs are personal data under
   POPIA: retained per `docs/02-access-control.md` and readable only with `audit:read`.

**Decision:** the assistant is a module in the gateway BFF, not a new service. It is
the only place that already sees every context and holds the session. It calls
commerce/logistics/notifications over the same internal APIs the BFF already proxies,
so it has no privileged path to data.

**Decision:** no vector database at launch. The corpus is small and structured.
Retrieval is (a) filtered catalogue queries for product intent, (b) keyword search over
published content and policies. This is simpler, cheaper, and — critically —
*inspectable*: every retrieved fact is a row a person can check. If recall proves
inadequate, adding embeddings is an additive change behind the same retrieval
interface, and gets its own ADR.

**Decision:** the model provider is behind an interface (`AnswerModel`), like the
payment providers (ADR 0007). One implementation calls a hosted LLM; a test
implementation returns canned text. This keeps the assistant testable without network
access, and lets the provider change without touching retrieval or rules.

## 5. Structured data is generated from rendered objects

JSON-LD is produced by pure functions that take the same object the page renders:
`productJsonLd(variant)`, `recipeJsonLd(content)`, `breadcrumbJsonLd(path)`.

**Decision:** a test asserts that the price in the JSON-LD equals the price the page
displays, for the same variant. This is the only way to stop the two drifting, and
drifted structured data is worse than none: it earns a manual action.

**Decision:** no `AggregateRating` markup until reviews exist and are published. Markup
for ratings that are not on the page is a spam signal.

## Consequences

- Phase 6 adds **no deployable** and **one new runtime dependency** (an LLM client),
  gated.
- Two new schemas-worth of tables, all inside existing schemas (`catalog`, `sales`,
  `notifications`), so no new migration namespace.
- Marketing email introduces an operational duty: watch bounces and complaints, keep
  the sending domain healthy. This is ongoing, not a one-off build.
- The assistant's value is bounded by content quality. If T-071/T-072 are thin, the
  assistant will refuse often — which is the correct behaviour, and a signal to write
  more content rather than to loosen the rules.
